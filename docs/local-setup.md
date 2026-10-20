# 개인 노트북 준비: Windows / Apple Silicon Mac

확인일: 2026-10-20. **14:30–15:15의 공통 목표는 모델 연결 전 웹 인터페이스 완성**입니다. 프롬프트 입력, 참조 이미지, 결과 미리보기, 히스토리부터 구현합니다. 드라이버 설치나 대형 모델 다운로드가 늦어져도 이 부분은 진행할 수 있습니다.

## 먼저 실행 경로 선택

| 경로 | 준비 | 수업 운영 기준 |
|---|---|---|
| 한양대 GPU 서버 | 최신 브라우저, 인터넷, 강사가 안내한 주소·수업 키 | 로컬 CUDA·PyTorch·FLUX 설치 불필요 |
| Windows NVIDIA 로컬 | NVIDIA GPU, 호환 드라이버, Python, CUDA 지원 PyTorch | **VRAM 16 GB 이상 / RAM 32 GB 권장**. 12 GB 이하는 오프로딩·양자화 등 별도 검증이 필요하므로 수업에서는 서버 우선 |
| Apple Silicon Mac 로컬 | M 시리즈, arm64 Python, PyTorch의 MPS | **통합 메모리 24 GB 권장**, 32 GB 이상이면 여유가 더 큼. 16 GB는 최적화 구성에서 실행 가능한 경우가 있지만 이번 기본 구성의 안정 실행을 보장하지 않음 |

위 메모리 수치는 수업 운영을 위한 권장 기준입니다. BFL 모델 카드의 약 13 GB VRAM 안내는 실행 구성에 따른 수치이며, 모든 13 GB 기기가 충분하다는 뜻은 아닙니다. Mac의 통합 메모리는 운영체제·브라우저·GPU가 함께 사용하므로 NVIDIA의 전용 VRAM과 직접 비교하지 않습니다.

Mac 16 GB 사용자는 웹 UI와 마스크 선택은 로컬에서 진행하고, 이미지 생성·편집은 서버로 연결하는 경로를 기본으로 합니다. 24 GB도 해상도·동시 앱·오프로딩 방식에 따라 메모리가 부족할 수 있으므로 512×512 한 장부터 확인합니다. 이번 안내를 위해 참가자별 Windows/Mac 전체 모델 추론을 직접 검증한 것은 아닙니다.

공통으로 로컬 FLUX 경로는 SSD **35–40 GB 이상의 여유 공간**, 전원 어댑터를 권장합니다. CPU 전용 FLUX 생성은 수업 시간 안의 대안으로 권장하지 않습니다.

## Windows: 드라이버와 CUDA Toolkit은 다릅니다

1. 작업 관리자 → 성능에서 **정확한 NVIDIA GPU 이름과 전용 GPU 메모리**를 확인합니다. GPU 모델명만으로 VRAM을 추정하지 않습니다.
2. `nvidia-smi`가 실행되는지 확인합니다. 실행된다면 드라이버가 이미 설치되어 있을 수 있습니다. 현재 환경을 먼저 검사하고 무조건 재설치하지 않습니다.
3. 드라이버가 없거나 PyTorch와 호환되지 않으면 [NVIDIA 공식 드라이버](https://www.nvidia.com/Download/index.aspx)에서 해당 GPU·Windows용 드라이버를 설치합니다. 재부팅이 필요할 수 있으므로 웹 UI 실습 중 강제 재부팅하지 않습니다.
4. Python 3.11 64-bit 가상환경을 만들고 [PyTorch 설치 선택기](https://pytorch.org/get-started/locally/)에서 **Windows / Pip / Python / 해당 GPU와 드라이버가 지원하는 CUDA**를 선택합니다. 출력된 명령을 사용합니다.

**일반적인 PyTorch wheel 추론은 NVIDIA 드라이버 + CUDA 지원 PyTorch 패키지로 충분하며, CUDA Toolkit 전체를 별도로 설치할 필요는 없습니다.** Toolkit/nvcc는 직접 소스를 컴파일하거나 특정 확장을 빌드할 때 필요할 수 있습니다. 이 수업의 기본 경로는 그런 빌드를 요구하지 않습니다. 특히 한양대 서버의 CUDA 버전을 참가자 노트북에 그대로 강제하지 않습니다.

`nvidia-smi`에 나오는 CUDA Version은 드라이버가 지원하는 CUDA 수준입니다. 로컬 Toolkit이 설치되었다거나 현재 PyTorch가 그 버전이라는 뜻은 아닙니다. 설치 후 확인합니다.

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
# 이 위치에서 PyTorch 공식 선택기가 제시한 명령을 실행
python -c "import torch; print('torch:', torch.__version__); print('CUDA runtime:', torch.version.cuda); print('CUDA usable:', torch.cuda.is_available())"
```

PowerShell 정책 때문에 활성화가 차단되면 시스템 정책을 임의 변경하지 말고 `.\.venv\Scripts\python.exe`를 `python` 대신 사용하면 됩니다.

## Mac: CUDA 대신 MPS

- Apple Silicon **M1/M2/M3/M4 등 M 시리즈**를 사용합니다. 이 안내는 Intel Mac용 경로가 아닙니다.
- CUDA나 NVIDIA 드라이버를 설치하지 않습니다. PyTorch의 **MPS(Metal)**가 Apple GPU를 사용합니다.
- 현재 PyTorch 배포판과 호환되는 macOS가 필요합니다. 수업 준비 기준은 **macOS 14 이상**, **arm64 Python 3.11**입니다. Rosetta의 x86_64 Python을 사용하지 않습니다.
- Apple의 PyTorch 준비 안내에는 **Xcode Command Line Tools**가 포함되어 있습니다. 터미널에서 `xcode-select -p`로 먼저 확인하고 없으면 `xcode-select --install`로 작은 명령행 도구 설치를 시작할 수 있습니다. **App Store의 전체 Xcode 설치는 요구하지 않습니다.** 일반 wheel 설치가 정상 동작하는데 CLI 도구만 추가하느라 실습을 멈추지 않습니다. 소스 빌드 오류가 생기면 무리하게 해결하지 말고 서버 경로로 전환합니다.

```bash
python3 -c "import platform; print(platform.machine())"
# arm64인지 확인
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install torch
python -c "import torch; print(torch.__version__); print('MPS built:', torch.backends.mps.is_built()); print('MPS usable:', torch.backends.mps.is_available())"
```

`MPS usable: True`는 PyTorch가 GPU를 볼 수 있다는 뜻입니다. FLUX 전체 모델이 해당 메모리에서 성공한다는 검사와는 별개입니다. 메모리 부족 시 PyTorch의 안전 메모리 한도를 해제하는 설정을 쓰지 않습니다.

## 다운로드와 모델 실행을 분리합니다

다운로드에 필요한 패키지는 `requirements-download.txt` 한 개입니다. **다운로드를 시작하기 위해 먼저 CUDA Toolkit이나 PyTorch를 설치할 필요는 없습니다.** 아래 명령은 Windows/Mac에서 동일하며, 활성화한 Python 가상환경에서 실행합니다.

```bash
python -m pip install -r requirements-download.txt
python scripts/download_models.py --model flux
# 강사 안내 후 로컬 FLUX 참가자만:
python scripts/download_models.py --model flux --download
```

분할 모델은 [별도 안내](segmentation.md)를 따릅니다. 브라우저 WASM에서 실행하므로 로컬 PyTorch가 필요하지 않습니다.

## FLUX를 연결할 때의 공통 기준

웹 인터페이스가 완성되고 다운로드 검사가 끝난 뒤, 로컬 백엔드에서 모델을 연결합니다. **HTML 자체가 16 GB의 Python 모델을 직접 실행하는 구조가 아닙니다.** 브라우저 UI → 로컬 Python 백엔드 → FLUX, 또는 브라우저 UI → 한양대 GPU API로 연결합니다.

검증된 한양대 서버 환경은 Python 3.12, PyTorch 2.11.0+cu130, Diffusers 0.39.0, Transformers 5.14.1, Accelerate 1.14.0입니다. 로컬은 운영체제·GPU에 맞는 PyTorch wheel이 필요하므로 서버의 `+cu130`을 복사하지 않습니다. 로컬 모델을 연결하는 에이전트는 우선 다음 계열을 사용하고 설치 후 import 및 512×512 한 장 생성 검사를 수행합니다.

```bash
python -m pip install "diffusers==0.39.0" "transformers==5.14.1" "accelerate==1.14.0" safetensors Pillow
python -c "from diffusers import Flux2KleinPipeline; print('Flux2KleinPipeline ready')"
```

모델 경로는 `models/FLUX.2-klein-4B`입니다. `local_files_only=True`로 이미 받은 파일을 사용하고, `num_inference_steps=4`, `guidance_scale=1.0`, 한 요청당 한 장으로 시작합니다. `base` 모델용 많은 스텝 수를 혼합하지 않습니다. CUDA에서는 BF16 지원 여부를 확인하고 CPU offload를 활용할 수 있습니다. MPS에서는 현재 PyTorch/macOS에 지원되는 dtype과 메모리 설정을 별도로 확인해야 하므로 CUDA용 offload 설정을 그대로 복사하지 않습니다.

가중치가 16 GB에 가깝고 활성값·메모리 복사·운영체제 공간이 추가로 필요합니다. Mac 16 GB 또는 NVIDIA VRAM이 부족한 기기에서 오류가 나면 **512×512 한 장 → 불필요한 앱 종료 → 서버 연결** 순서로 처리합니다. 검증되지 않은 양자화 모델·추가 GPU 라이브러리를 교육 중 무작정 설치하지 않습니다.

## 에이전트에게 전달할 지시

> 이 프로젝트의 로컬 준비와 모델 다운로드 가이드를 읽고 내 OS, CPU 아키텍처, GPU, GPU 메모리/통합 메모리, 디스크 공간을 먼저 확인해줘. Windows는 드라이버와 CUDA용 PyTorch wheel의 호환성을 점검하고 CUDA Toolkit은 기본 설치하지 마. Mac은 arm64 Python과 MPS를 사용해. 드라이버/OS 변경이나 재부팅은 먼저 설명해줘. 웹 UI 작업은 모델 설치와 분리해서 진행하고, 메모리 부족이나 다운로드 지연이 생기면 한양대 서버 연결 경로로 전환해줘. 이번 수업의 distilled 4B 모델과 기본값만 사용해.

## 공식 확인 자료

- [BFL FLUX.2-klein-4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B)
- [PyTorch 설치 선택기](https://pytorch.org/get-started/locally/)
- [PyTorch MPS 안내](https://docs.pytorch.org/docs/stable/notes/mps.html)
- [Apple PyTorch / Metal 준비 사항](https://developer.apple.com/metal/pytorch/)
- [NVIDIA CUDA 드라이버 호환성](https://docs.nvidia.com/deploy/cuda-compatibility/minor-version-compatibility.html)
- [Diffusers MPS 최적화 안내](https://huggingface.co/docs/diffusers/main/en/optimization/mps)
