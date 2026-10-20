# 개인 노트북에서 FLUX 실행하기

먼저 웹 인터페이스를 만든 뒤, 다운로드한 모델을 로컬 API에 연결합니다. 브라우저 → 로컬 Python API → FLUX 순서로 동작합니다.

## 실행 환경 선택

| 경로 | 준비 사항 |
|---|---|
| GPU 서버 | 브라우저, 인터넷, 강사가 안내한 서버 주소와 API 키 |
| Windows NVIDIA | VRAM 16 GB 이상, RAM 32 GB 권장, NVIDIA 드라이버, CUDA용 PyTorch |
| Apple Silicon Mac | M 시리즈, macOS 14 이상, arm64 Python, PyTorch MPS. **통합 메모리 24 GB 권장**, 32 GB 이상이면 여유가 더 큽니다. |

로컬 모델 파일은 약 **16 GB**이며, SSD 여유 공간은 **35–40 GB 이상**을 준비합니다. Mac 16 GB는 GPU 서버 경로를 권장합니다. Mac 24 GB도 브라우저와 운영체제가 같은 메모리를 사용하므로, 다른 큰 앱을 정리하고 **512×512 한 장**부터 확인합니다. 모델 실행에 필요한 실제 메모리는 해상도와 기기 환경에 따라 달라집니다.

## 1. Python 환경 준비

Python **3.11 또는 3.12**를 사용합니다. 아래 명령은 프로젝트 폴더에서 실행합니다.

### Windows NVIDIA

1. 작업 관리자 → 성능에서 GPU 이름과 **전용 GPU 메모리**를 확인합니다.
2. 터미널에서 `nvidia-smi`로 드라이버를 확인합니다. 설치·업데이트가 필요하면 [NVIDIA 공식 드라이버](https://www.nvidia.com/Download/index.aspx)를 사용합니다.
3. [PyTorch 설치 선택기](https://pytorch.org/get-started/locally/)에서 Windows / Pip / Python / GPU·드라이버에 맞는 CUDA를 선택합니다.

일반적인 PyTorch 패키지 추론에는 **NVIDIA 드라이버와 CUDA용 PyTorch**가 필요합니다. CUDA Toolkit은 확장 모듈을 직접 빌드할 때 사용하는 개발 도구입니다.

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
# PyTorch 공식 선택기가 제시한 설치 명령을 이 위치에서 실행합니다.
python -c "import torch; print(torch.__version__); print('CUDA:', torch.cuda.is_available())"
```

가상환경 활성화가 차단되면 `.\.venv\Scripts\python.exe`로 아래 명령의 `python`을 대신할 수 있습니다. 드라이버 변경과 재부팅은 작업을 저장한 뒤 진행합니다.

### Apple Silicon Mac

Apple GPU는 **MPS(Metal)**를 사용합니다. `platform.machine()`이 `arm64`인지 확인합니다.

```bash
python3 -c "import platform; print(platform.machine())"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install torch==2.11.0
python -c "import torch; print(torch.__version__); print('MPS:', torch.backends.mps.is_available())"
```

[Apple 준비 안내](https://developer.apple.com/metal/pytorch/)에 따라 명령행 도구는 `xcode-select -p`로 확인합니다. 필요할 때 `xcode-select --install`로 Command Line Tools를 설치합니다. 아래 API는 MPS의 BF16 연산 가능 여부를 확인한 후 모델을 불러옵니다.

## 2. 모델 다운로드

이 단계는 PyTorch 설치와 병행할 수 있습니다. [다운로드 안내](model-download.md)의 고정된 20개 파일을 받습니다.

```bash
python -m pip install -r requirements-download.txt
python scripts/download_models.py --model flux --download
python scripts/download_models.py --model flux --verify
```

모델 저장 위치: `models/FLUX.2-klein-4B`

## 3. 로컬 API 실행

PyTorch가 GPU를 인식하고 다운로드 검사가 완료되면 실행합니다.

```bash
python -m pip install -r requirements-local.txt
python scripts/local_api.py
```

브라우저에서 `http://127.0.0.1:8032/health`를 열어 `ready_workers`가 `1`이 되는지 확인합니다. 첫 실행에서는 모델을 메모리로 읽는 시간이 필요합니다. 터미널을 열어둔 상태로 웹 인터페이스의 연결 정보를 입력합니다.

| 설정 | 값 |
|---|---|
| API 주소 | `http://127.0.0.1:8032` |
| API 키 입력란 | `local` |
| 첫 생성 크기 | `512×512` |
| 생성 설정 | 4 steps / guidance 1.0 / 한 장 |

`local`은 이 컴퓨터의 로컬 API를 선택할 때 사용하는 값입니다. GPU 서버 연결에는 강사가 제공한 주소와 키를 사용합니다. 웹 화면은 별도 터미널에서 `python scripts/serve.py`로 열 수 있습니다.

CUDA에서는 BF16과 CPU offload를 기본으로 사용하고, MPS에서는 BF16으로 모델을 올립니다. 메모리 부족 시 다른 큰 앱을 정리한 뒤 512×512로 확인하고, 수업 중에는 GPU 서버 연결로 이어갈 수 있습니다.

## 4. 생성·편집 확인

1. 텍스트로 테이블 이미지 한 장을 생성합니다.
2. 결과를 참조 이미지로 선택하고 색상·소재 변경 지시문을 입력합니다.
3. 결과와 프롬프트가 히스토리에 남고 WebP로 저장되는지 확인합니다.

한국어 디자인 의도는 [영어 프롬프트 예시](design-brief.md#프롬프트를-영어로-정리하기)를 참고해 정리하면 좋습니다. 선택 영역 합성은 [분할 안내](segmentation.md)에서 추가할 수 있습니다.

## 환경 확인 기록

GPU 서버의 Python 3.12 / PyTorch 2.11.0 / Diffusers 0.39.0 / Transformers 5.14.1 / Accelerate 1.14.0 환경에서, 제공된 로컬 API와 선택 다운로드 20개 파일로 512×512 생성·편집을 확인했습니다. Windows·Mac은 각 기기의 GPU 확인과 첫 이미지 생성 결과를 기준으로 연결을 점검합니다.

- [공식 FLUX.2-klein-4B 모델](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B)
- [PyTorch 설치](https://pytorch.org/get-started/locally/)
- [PyTorch MPS](https://docs.pytorch.org/docs/stable/notes/mps.html)
- [Apple PyTorch / Metal](https://developer.apple.com/metal/pytorch/)
