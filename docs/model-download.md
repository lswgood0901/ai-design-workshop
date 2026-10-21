# FLUX.2-klein-4B 다운로드

개인 노트북에서는 운영체제에 맞는 **FLUX.2-klein-4B distilled 4비트 실행 경로**를 준비합니다. GPU 서버 참가자는 서버에 준비된 모델을 이용합니다.

## 용량과 선택

| 환경 | 스크립트 선택 | 다운로드 구성·용량 | 기본 저장 폴더 |
|---|---|---|---|
| Apple Silicon Mac | `--model flux-mlx` | MLX 4비트 **12개 파일 · 4,619,700,724 bytes · 4.62 GB (4.30 GiB)** | `models/FLUX.2-klein-4B-mlx-4bit` |
| Windows NVIDIA | `--model flux` | 공식 Diffusers **20개 파일 · 15,980,151,320 bytes · 15.98 GB (14.88 GiB)** | `models/FLUX.2-klein-4B` |
| 선택 영역 분할 | `--model segmentation` | SlimSAM q8 **13.79 MB** | `public/models/Xenova/slimsam-77-uniform` |

Mac 구성은 커뮤니티가 MLX용으로 미리 변환한 4비트 모델입니다. 텍스트 인코더·이미지 모델·VAE·토크나이저를 포함하며, 해당 구성으로 생성과 편집을 확인했습니다. Windows는 공식 Diffusers 파일을 다운로드한 뒤 실행 시 CUDA NF4로 읽습니다. 이미 받은 Windows용 공식 폴더는 그대로 재사용합니다.

두 FLUX 구성은 파일 형식이 다릅니다. 운영체제별 폴더를 선택하고, `local_api.py --model-dir`에도 같은 경로를 지정합니다. 새 설치에는 패키지와 실행 여유를 포함해 Mac **20 GB 이상**, Windows **35–40 GB 이상**의 SSD 여유 공간을 준비합니다. 공개 모델은 로그인 없이 다운로드할 수 있습니다.

## 다운로드

[환경 준비](local-setup.md)에서 만든 가상환경을 사용합니다. 아래는 **Mac MLX 4비트** 예시입니다.

```bash
python -m pip install -r requirements-download.txt
python scripts/download_models.py --model flux-mlx
python scripts/download_models.py --model flux-mlx --download
python scripts/download_models.py --model flux-mlx --verify
```

첫 실행은 파일 목록과 용량을 보여줍니다. `--download`가 실제 다운로드를 시작하고, 완료 후 파일 크기와 체크섬을 확인합니다. Windows에서는 위 명령의 `flux-mlx`를 `flux`로 바꿉니다.

이미 다운로드한 폴더 또는 USB로 받은 폴더는 검증부터 진행합니다.

```bash
# Mac의 기존 MLX 4비트 폴더 예시
python scripts/download_models.py --model flux-mlx --verify --output-dir "/Users/models/FLUX.2-klein-4B/mlx-4bit"
# Windows의 기존 공식 Diffusers 폴더 예시
python scripts/download_models.py --model flux --verify --output-dir "D:/AI_models/FLUX.2-klein-4B"
```

폴더가 완전하면 추가 다운로드 없이 사용할 수 있습니다. 중단된 다운로드는 같은 `--download` 명령과 경로로 이어받습니다. 체크섬 오류가 있으면 `--download --force-download`로 해당 구성을 다시 받습니다.

선택 실습의 클릭 영역 분할 모델은 다음 명령으로 받습니다.

```bash
python scripts/download_models.py --model segmentation --download
```

## 예상 시간

순수 전송시간이며 패키지 설치·파일 검증 시간이 추가됩니다.

| 실제 속도 | Mac MLX 4.62 GB | Windows Diffusers 15.98 GB |
|---|---:|---:|
| 1 MB/s | 약 1시간 17분 | 약 4시간 26분 |
| 10 MB/s | 약 7분 42초 | 약 26분 38초 |
| 20 MB/s | 약 3분 51초 | 약 13분 19초 |
| 50 MB/s | 약 1분 32초 | 약 5분 20초 |

`1 MB/s = 8 Mbps`입니다. 교육장에서는 여러 사람이 회선을 공유하므로 실제 속도를 확인하며 진행합니다. 다운로드 중에도 웹 화면 작업을 이어갈 수 있습니다.

## 에이전트에게 전달할 지시

> 이 문서와 `scripts/download_models.py`를 읽고 운영체제, 기존 모델 폴더, 저장 공간을 확인해줘. Apple Silicon Mac은 `flux-mlx`, Windows NVIDIA는 `flux` 구성을 선택해줘. 기존 폴더가 있으면 검증 후 재사용하고, 새 다운로드는 고정 revision으로 받아줘. 완료 후 파일 검증 결과와 로컬 API에 전달할 경로를 알려줘.

## 고정 버전 확인

확인일: **2026-10-21**. 스크립트에 파일 목록·크기·체크섬을 고정하고 다운로드 완료 시 검증합니다.

- [MLX 4비트 구성](https://huggingface.co/mlx-community/flux2-klein-4b-4bit/tree/860e87183ceb29e39627c0612ebd66d8ea66e68c) · revision `860e87183ceb29e39627c0612ebd66d8ea66e68c`
- [공식 Diffusers 구성](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B/blob/e7b7dc27f91deacad38e78976d1f2b499d76a294/model_index.json) · revision `e7b7dc27f91deacad38e78976d1f2b499d76a294`
- [SlimSAM 구성](https://huggingface.co/Xenova/slimsam-77-uniform/tree/5850ab45f587c112167512ffef949107115e26a0) · revision `5850ab45f587c112167512ffef949107115e26a0`
