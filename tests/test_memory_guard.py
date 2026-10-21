"""Exercise real child termination with simulated low-memory readings."""
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from memory_guard import Limits, ResourceStop, Supervisor, stop_reason


def reading(**values):
    return {'available_gib': 12, 'worker_memory_gib': 1, 'swap_gib': 0, 'disk_gib': 20, **values}


class GuardTests(unittest.TestCase):
    def test_each_stop_condition(self):
        for row in [reading(available_gib=3.9), reading(worker_memory_gib=7.1),
                    reading(swap_gib=.6), reading(disk_gib=7.9)]:
            self.assertIsNotNone(stop_reason(row, reading(), 1, Limits()))
        self.assertIsNotNone(stop_reason(reading(swap_gib=1.1), reading(swap_gib=1.1), 1, Limits()))
        self.assertIsNotNone(stop_reason(reading(), reading(), 601, Limits()))
        self.assertIsNone(stop_reason(reading(), reading(), 1, Limits()))

    def test_low_memory_prevents_start(self):
        with tempfile.TemporaryDirectory() as folder, patch('memory_guard.subprocess.Popen') as popen:
            folder = Path(folder)
            guard = Supervisor(sampler=lambda *_: reading(available_gib=8))
            with self.assertRaises(ResourceStop):
                guard.run([sys.executable, '-c', 'pass'], folder, folder / 'log')
            popen.assert_not_called()

    def test_running_child_is_killed(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            guard = Supervisor(sampler=lambda _path, pid=None: reading(available_gib=3 if pid else 12))
            started = time.monotonic()
            with self.assertRaises(ResourceStop):
                guard.run([sys.executable, '-c', 'import time; time.sleep(60)'], folder, folder / 'log')
            self.assertLess(time.monotonic() - started, 5)
            self.assertEqual(guard.last_report['status'], 'stopped')

    def test_monitor_failure_also_kills_child(self):
        def fail(_path, pid=None):
            if pid:
                raise OSError('monitor unavailable')
            return reading()
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            guard = Supervisor(sampler=fail)
            started = time.monotonic()
            with self.assertRaises(OSError):
                guard.run([sys.executable, '-c', 'import time; time.sleep(60)'], folder, folder / 'log')
            self.assertLess(time.monotonic() - started, 5)


if __name__ == '__main__':
    unittest.main()
