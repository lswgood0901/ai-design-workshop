# 모델 다운로드: 수업 공통 규칙

확인일: 2026-10-20. 이번 수업은 **FLUX.2-klein-4B distilled**를 사용합니다. `Base`, `9B`, `FLUX.3`와 혼용하지 않습니다. 한양대 GPU 서버를 이용하는 참가자는 **FLUX를 다운로드할 필요가 없습니다**. 이미지 영역 선택용 SlimSAM은 별도의 작은 브라우저 모델입니다.

## 정확한 용량

| 항목 | 다운로드 크기 | 비고 |
|---|---:|---|
| FLUX.2-klein-4B 수업용 Diffusers 구성 | **15,980,151,320 bytes = 15.98 GB = 14.88 GiB** | 20개 파일, 아래 스크립트가 받는 구성 |
| 공식 저장소 전체 | 23,740,007,447 bytes = 23.74 GB | 루트 단일 체크포인트와 Diffusers 구성의 중복 포함 |
| 루트 `flux-2-klein-4b.safetensors` 하나 | 7.75 GB | 이것만으로는 수업용 Diffusers 파이프라인을 실행할 수 없음 |
| SlimSAM q8 브라우저 분할 모델 | **13,789,807 bytes = 13.79 MB** | 5개 파일; JS/WASM 실행 라이브러리는 별도 |

GB는 1,000,000,000 bytes, GiB는 1,073,741,824 bytes입니다. 파일 관리자 표시와 숫자가 다를 수 있습니다. 로컬 FLUX 참가자는 Python 패키지·임시 파일·결과물을 포함해 **SSD 여유 공간 35–40 GB 이상**을 확보하는 편이 좋습니다. 다운로드 용량과 GPU 메모리는 서로 다른 값입니다.

전체 저장소를 `git clone`하거나 모든 `.safetensors`를 받지 않습니다. 루트의 7.75 GB 파일은 다른 로더용 단일 체크포인트이며, 수업용 `transformer/`의 가중치와 중복됩니다. 다음 필수 폴더만 받습니다.

```text
models/FLUX.2-klein-4B/
├── model_index.json
├── scheduler/
├── text_encoder/
├── tokenizer/
├── transformer/
└── vae/
```

가이드와 라이선스 파일도 함께 저장됩니다. 공식 저장소는 확인 시점에 `gated: false`인 Apache-2.0 공개 모델입니다. 이 다운로드에는 **Hugging Face 계정·로그인·API 키·유료 플랜이 필요하지 않습니다**.

## 참가자 실행 순서

프로젝트 폴더에서 실행합니다. Windows는 `python` 대신 `py -3.11`을 사용할 수 있고, Mac은 `python3`를 사용합니다. 가상환경을 활성화했다면 모두 `python`으로 실행하면 됩니다. Python 설치·가상환경 생성은 [로컬 준비](local-setup.md)를 참고합니다.

```bash
python -m pip install -r requirements-download.txt
```

먼저 **다운로드 계획만** 확인합니다. 작은 공개 메타데이터만 조회하며 모델 가중치를 받지 않습니다.

```bash
python scripts/download_models.py --model flux
```

강사 안내 후 로컬 FLUX 참가자만 시작합니다.

```bash
python scripts/download_models.py --model flux --download
```

이미지의 클릭 영역 선택을 사용할 참가자는 작은 분할 모델을 받습니다.

```bash
python scripts/download_models.py --model segmentation --download
```

완료 시 각 파일의 크기와 체크섬을 검사하고 `.workshop-model-manifest.json`을 남깁니다. FLUX의 전체 체크섬 확인에는 디스크 속도에 따라 몇 분이 추가로 걸립니다. 대상 경로는 현재 터미널 위치가 아니라 **이 프로젝트 루트 기준**으로 고정됩니다.

- FLUX: `models/FLUX.2-klein-4B/`
- SlimSAM: `public/models/Xenova/slimsam-77-uniform/`

## 끊긴 다운로드·USB 복사본

연결이 끊기면 **같은 명령을 다시 실행**합니다. Hugging Face의 로컬 다운로드 메타데이터와 미완료 파일을 이용해 이어받습니다. 도중에 대상 폴더 안의 `.cache/huggingface`를 삭제하지 않습니다. 학교에서 배포한 USB 폴더를 복사했다면 인터넷 없이 검사할 수 있습니다.

```bash
python scripts/download_models.py --model flux --verify
python scripts/download_models.py --model segmentation --verify
```

이 검사는 Python 표준 라이브러리만 사용합니다. 인터넷이나 Hugging Face 로그인이 필요하지 않습니다. 원본 폴더의 경로가 다른 경우 다음처럼 직접 지정합니다.

```bash
python scripts/download_models.py --model flux --verify --output-dir "D:/AI_models/FLUX.2-klein-4B"
```

파일이 없거나 덜 받아졌다면 `--download`를 다시 실행합니다. 크기는 같지만 체크섬이 틀리면, 강사에게 확인 후 `--download --force-download`로 **선택된 모델 파일을 다시 받습니다**. 검사가 실패한 모델을 그대로 로드하지 않습니다.

## 시간 계산과 현장 운영

15.98 GB를 한 사람이 계속 안정적으로 받는 경우의 순수 전송시간입니다. 설치·검증 시간은 별도입니다.

| 실제 다운로드 속도 | 약 소요 시간 |
|---|---:|
| 1 MB/s (= 8 Mbps) | 4시간 26분 |
| 10 MB/s (= 80 Mbps) | 26분 38초 |
| 20 MB/s (= 160 Mbps) | 13분 19초 |
| 50 MB/s (= 400 Mbps) | 5분 20초 |

**1 Mbps**라면 약 35시간 31분입니다. `MB/s`와 `Mbps`를 구분합니다. 동시에 받는 사람이 많으면 학교·교육장 회선과 Wi-Fi 대역폭을 공유하므로 위 시간이 그대로 보장되지 않습니다. 쉬는 시간 안에 끝나지 않으면 서버 경로로 실습을 이어갑니다. USB 배포는 폴더 구조와 고정 버전을 그대로 복사하고 체크섬 검사를 통과해야 합니다.

## Codex / Claude에게 전달할 지시

> 이 프로젝트의 `docs/model-download.md`와 `scripts/download_models.py`를 먼저 읽어줘. 먼저 운영체제, Python, 디스크 여유 공간, 다운로드 계획을 확인해줘. FLUX는 이 프로젝트가 고정한 distilled 4B Diffusers 구성만 사용하고 루트 single-file, Base, 9B, 다른 양자화 모델을 임의로 추가하지 마. 서버 경로를 선택했다면 FLUX를 다운로드하지 마. 모델 다운로드를 시작할 때는 제공된 스크립트를 사용하고 완료 후 검증 결과를 보여줘. 로그인이나 비밀키를 요구하지 마.

## 고정 버전과 확인 출처

- [FLUX.2-klein-4B 모델 카드](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B)
- [FLUX 고정 버전 공개 메타데이터](https://huggingface.co/api/models/black-forest-labs/FLUX.2-klein-4B/revision/e7b7dc27f91deacad38e78976d1f2b499d76a294?blobs=true): `e7b7dc27f91deacad38e78976d1f2b499d76a294`
- [SlimSAM 고정 버전 공개 메타데이터](https://huggingface.co/api/models/Xenova/slimsam-77-uniform/revision/5850ab45f587c112167512ffef949107115e26a0?blobs=true): `5850ab45f587c112167512ffef949107115e26a0`
- [Hugging Face Hub 다운로드 안내](https://huggingface.co/docs/huggingface_hub/guides/download)
