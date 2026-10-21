"""Supervise one inference child independently of its GPU runtime."""
from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import psutil

GIB = 2 ** 30


class ResourceStop(RuntimeError):
    """An inference request was stopped to preserve system resources."""


@dataclass(frozen=True)
class Limits:
    start_gib: float = 9
    available_gib: float = 4
    worker_memory_gib: float = 7
    swap_growth_gib: float = .5
    swap_total_gib: float = 1
    disk_gib: float = 8
    seconds: float = 600
    poll_seconds: float = .25


def snapshot(directory: Path, pid=None):
    rss = 0
    if pid:
        try:
            proc = psutil.Process(pid)
            for child in [proc, *proc.children(recursive=True)]:
                try:
                    info = child.memory_info()
                    rss += info.private if os.name == 'nt' else info.rss
                except psutil.NoSuchProcess:
                    pass
        except psutil.NoSuchProcess:
            pass
    return dict(available_gib=psutil.virtual_memory().available / GIB,
                worker_memory_gib=rss / GIB, memory_metric=('private' if os.name == 'nt' else 'rss'), swap_gib=psutil.swap_memory().used / GIB,
                disk_gib=psutil.disk_usage(directory).free / GIB)


def stop_reason(row, baseline, elapsed, limits):
    if row['available_gib'] < limits.available_gib:
        return '사용 가능한 메모리가 4GiB 아래로 내려가 작업을 중단했습니다.'
    if row['worker_memory_gib'] > limits.worker_memory_gib:
        return '이미지 작업의 메모리가 7GiB를 넘어 작업을 중단했습니다.'
    if row['swap_gib'] - baseline['swap_gib'] > limits.swap_growth_gib:
        return '스왑 사용량이 512MiB 이상 증가해 작업을 중단했습니다.'
    if row['swap_gib'] > limits.swap_total_gib:
        return '전체 스왑 사용량이 1GiB를 넘어 작업을 중단했습니다.'
    if row['disk_gib'] < limits.disk_gib:
        return '저장 공간이 8GiB 미만이어서 작업을 중단했습니다.'
    if elapsed > limits.seconds:
        return '이미지 작업이 10분을 넘어 종료했습니다.'
    return None


def kill_worker(proc):
    if proc.poll() is not None:
        return
    try:
        if os.name == 'posix':
            os.killpg(proc.pid, signal.SIGKILL)
        else:
            parent = psutil.Process(proc.pid)
            for child in parent.children(recursive=True):
                try:
                    child.kill()
                except psutil.NoSuchProcess:
                    pass
            parent.kill()
    except (ProcessLookupError, psutil.NoSuchProcess):
        pass
    proc.wait(timeout=10)


class Supervisor:
    def __init__(self, limits=None, sampler=snapshot):
        self.limits = limits or Limits()
        self.sampler = sampler
        self.cancel = threading.Event()
        self.last_report = None

    def close(self):
        self.cancel.set()

    def run(self, command, directory, log_path):
        base = self.sampler(directory)
        reason = stop_reason(base, base, 0, self.limits)
        if base['available_gib'] < self.limits.start_gib:
            reason = f"실행 전 여유 메모리가 {base['available_gib']:.1f}GiB입니다. 큰 앱을 정리해 9GiB 이상 확보한 뒤 다시 실행해 주세요."
        self.last_report = {'limits': asdict(self.limits), 'baseline': base, 'status': 'preflight'}
        if reason:
            self.last_report.update(status='stopped', reason=reason)
            raise ResourceStop(reason)
        if self.cancel.is_set():
            raise ResourceStop('로컬 API가 종료 중입니다.')
        env = os.environ.copy()
        env.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1',
                   TOKENIZERS_PARALLELISM='false', OMP_NUM_THREADS='4', OPENBLAS_NUM_THREADS='4')
        proc = None
        started = time.monotonic()
        minimum = base['available_gib']
        peak_rss, peak_swap = 0, base['swap_gib']
        try:
            with log_path.open('w', encoding='utf-8') as log:
                proc = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT,
                                        env=env, start_new_session=(os.name == 'posix'))
                self.last_report.update(status='running')
                while proc.poll() is None:
                    row = self.sampler(directory, proc.pid)
                    minimum = min(minimum, row['available_gib'])
                    peak_rss = max(peak_rss, row['worker_memory_gib'])
                    peak_swap = max(peak_swap, row['swap_gib'])
                    reason = stop_reason(row, base, time.monotonic() - started, self.limits)
                    if self.cancel.is_set():
                        reason = '로컬 API가 종료되어 이미지 작업을 중단했습니다.'
                    if reason:
                        raise ResourceStop(reason)
                    self.cancel.wait(self.limits.poll_seconds)
                code = proc.wait(timeout=10)
            self.last_report.update(status='completed' if code == 0 else 'worker_error', exit_code=code)
            return code
        except Exception as error:
            self.last_report.update(status='stopped', reason=str(error))
            raise
        finally:
            if proc is not None:
                kill_worker(proc)
            self.last_report.update(seconds=round(time.monotonic() - started, 2),
                                    minimum_available_gib=round(minimum, 3),
                                    peak_worker_memory_gib=round(peak_rss, 3), peak_swap_gib=round(peak_swap, 3))
