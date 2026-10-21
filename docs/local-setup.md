# 개인 노트북에서 FLUX 실행하기

웹 인터페이스를 만든 뒤, 모델을 로컬 API에 연결합니다. **브라우저 → 로컬 API → 4비트 FLUX** 순서로 동작하며, 요청마다 메모리 상태를 확인합니다.

## 실행 환경 선택

| 경로 | 실행 방식 | 준비 기준 |
|---|---|---|
| Apple Silicon Mac | MLX·MFLUX 4비트 | M 시리즈, macOS 14 이상, arm64 Python. 통합 메모리 **24 GB 권장** |
| Windows NVIDIA | CUDA·bitsandbytes NF4 | NVIDIA RTX 30 시리즈 이후(Ampere 이상), VRAM **8 GB 이상**, 실행 전 GPU 여유 **6 GiB 이상**. RAM **16 GB부터 점검**, 24–32 GB 권장 |
| GPU 서버 | 브라우저에서 서버 연결 | 인터넷, 강사가 안내한 서버 주소와 키 |

두 로컬 경로 모두 **실행 직전 사용 가능한 RAM이 9 GiB 이상**이어야 합니다. 16 GB 기기는 큰 앱을 정리한 뒤 이 기준을 확인합니다. 설치된 RAM이 16 GB라는 사실만으로 실행 가능 여부가 결정되지는 않습니다. Windows 8 GB VRAM도 초기 점검 기준이며, 실제 생성·편집 성공을 확인한 뒤 사용합니다. Intel Mac이나 다른 GPU의 Windows 기기는 GPU 서버 경로를 선택합니다.

## 1. Apple Silicon Mac 준비

Mac은 **MLX 4비트 모델**을 사용합니다. Python **3.11 또는 3.12**, `arm64` 환경을 확인하고 프로젝트 폴더에서 실행합니다.

```bash
python3 -c "import platform; print(platform.machine())"
python3 -m venv .venv-mlx
source .venv-mlx/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-local-mlx.txt
python -m pip install -r requirements-download.txt
python scripts/download_models.py --model flux-mlx --download
python scripts/download_models.py --model flux-mlx --verify
python scripts/local_api.py --backend mlx --model-dir models/FLUX.2-klein-4B-mlx-4bit
```

모델은 **12개 파일, 약 4.62 GB**입니다. 패키지 설치와 실행 여유를 포함해 새 설치 전 SSD 여유 **20 GB 이상**을 준비합니다. 이미 받은 MLX 4비트 폴더가 있으면 `--model-dir`에 그 경로를 지정합니다. 원본 Diffusers 폴더와 MLX 폴더는 파일 형식이 다르므로, [다운로드 안내](model-download.md)에서 경로를 확인합니다.

## 2. Windows NVIDIA 준비

1. 작업 관리자 → 성능에서 GPU 이름과 **전용 GPU 메모리**를 확인합니다.
2. `nvidia-smi`로 드라이버를 확인합니다. 업데이트가 필요하면 [NVIDIA 공식 드라이버](https://www.nvidia.com/Download/index.aspx)를 사용합니다.
3. [PyTorch 설치 선택기](https://pytorch.org/get-started/locally/)에서 Windows / Pip / Python / 드라이버에 맞는 CUDA를 선택합니다.

Python **3.11 또는 3.12**로 별도 환경을 만듭니다. 일반적인 패키지 추론에는 NVIDIA 드라이버와 CUDA용 PyTorch가 필요합니다. CUDA Toolkit은 확장 모듈을 직접 빌드할 때 사용합니다.

```powershell
py -3.11 -m venv .venv-cuda
.\.venv-cuda\Scripts\Activate.ps1
python -m pip install --upgrade pip
# PyTorch 공식 선택기가 제시한 설치 명령을 이 위치에서 실행합니다.
python -c "import torch; print(torch.__version__); print('CUDA:', torch.cuda.is_available())"
python -m pip install -r requirements-local-cuda.txt
python -m pip install -r requirements-download.txt
python scripts/download_models.py --model flux --download
python scripts/download_models.py --model flux --verify
python scripts/local_api.py --backend cuda --model-dir models/FLUX.2-klein-4B
```

활성화가 차단되면 `.venv-cuda\Scripts\python.exe`로 명령의 `python`을 대신합니다. 드라이버 변경과 재부팅은 작업을 저장한 뒤 진행합니다.

Windows는 공식 Diffusers 구성 **15.98 GB**를 받은 뒤 텍스트 인코더와 이미지 모델을 **NF4 4비트로 읽습니다**. 이미 받은 폴더는 `--verify --output-dir "D:/AI_models/FLUX.2-klein-4B"`로 확인하고 그대로 연결할 수 있습니다. 새 설치 전 SSD 여유 **35–40 GB 이상**을 준비합니다.

## 3. 기존 웹 화면에 연결

로컬 API 터미널을 열어둔 상태에서, 같은 가상환경의 새 터미널로 웹 화면을 실행합니다.

```bash
python scripts/serve.py
```

`http://127.0.0.1:8000`에서 **로컬 모델** 모드를 선택합니다.

| 설정 | 값 |
|---|---|
| API 주소 | `http://127.0.0.1:8032` |
| 로컬 연결 키 | `local` |
| 이미지 크기 | `512×512` |
| 생성 설정 | 4 steps / guidance 1.0 / 한 장 |

`http://127.0.0.1:8032/health`에서 `ready_workers: 1`이면 요청할 준비가 된 상태입니다. 모델은 이미지 생성·편집 요청이 들어올 때 읽고, 작업이 끝나면 해당 프로세스가 종료돼 메모리를 돌려줍니다. `--backend auto`를 사용하면 Apple Silicon Mac은 MLX, Windows NVIDIA는 CUDA 경로를 선택합니다. 포트 변경은 `--port 8032` 형식으로 지정합니다.

편집은 결과를 참조 이미지로 선택한 뒤 **수정 지시문**을 입력합니다. 먼저 참조 이미지 한 장으로 확인하고 결과·프롬프트가 히스토리에 남는지, WebP로 저장되는지 확인합니다. [영어 프롬프트 예시](design-brief.md#프롬프트를-영어로-정리하기)를 참고해 디자인 의도를 구체화합니다.

## 메모리 보호 설정

API가 별도 프로세스에서 메모리를 감시합니다. 기본 설정을 유지해 사용합니다.

| 확인 시점 | 기준 |
|---|---|
| 요청 시작 전 | 사용 가능한 RAM **9 GiB 이상** |
| 실행 중 중단 | 사용 가능한 RAM **4 GiB 미만**, **Mac RSS / Windows 프로세스 전용 메모리 7 GiB 초과** |
| 스왑 점검 | 요청 시작 대비 증가 **0.5 GiB 초과** 또는 총 사용량 **1 GiB 초과** 시 중단 |
| 저장 공간·시간 | 여유 공간 **8 GiB 미만** 또는 작업 **10분 초과** 시 중단 |
| Windows GPU | VRAM 여유 **1 GiB 미만** 시 중단, 할당 시에도 1 GiB 여유 확보 |

한 번에 한 작업을 처리하며, 중단 사유는 웹 화면에 표시됩니다. 작업을 저장한 뒤 큰 앱을 정리하거나 GPU 서버 모드로 전환할 수 있습니다. 이 설정은 과부하 위험을 줄이기 위한 보호장치이며, 운영체제·드라이버 수준의 멈춤까지 보장하지는 않습니다.

## 확인 기록

**2026-10-21 · M4 Pro / 통합 메모리 24 GB**에서 MLX 4비트, 512×512, 4 steps로 생성 약 **15초**, 편집 약 **17초**를 확인했습니다. 테스트 중 최소 여유 메모리는 약 **7.7 GiB**, 스왑 사용량은 **0**이었습니다. MFLUX 0.23.0 / MLX 0.32.4 환경입니다. 다른 기기의 속도와 메모리 사용량은 달라질 수 있습니다.

같은 Mac의 기존 웹 인터페이스에서도 로컬 생성 약 **12초**, 편집 약 **18초**를 확인했습니다. 결과 재사용·새로고침 후 히스토리 유지가 작동했고, 편집 중 최소 여유 메모리는 **7.8 GiB**, 스왑은 **0**이었습니다.

Windows CUDA NF4 경로는 **실제 Windows 기기 테스트 전**입니다. 안내된 패키지를 설치하고 첫 생성·편집 결과와 메모리 상태를 확인합니다.

- [MFLUX FLUX.2 생성·편집](https://github.com/mflux-community/mflux/blob/main/src/mflux/models/flux2/README.md)
- [MLX 4비트 모델](https://huggingface.co/mlx-community/flux2-klein-4b-4bit)
- [bitsandbytes Windows·CUDA 지원](https://huggingface.co/docs/bitsandbytes/main/en/installation)
- [PyTorch 설치](https://pytorch.org/get-started/locally/)
