# FLUX.2-klein-4B 다운로드

개인 노트북 실행에는 **FLUX.2-klein-4B distilled의 공식 Diffusers 구성**을 사용합니다. GPU 서버 참가자는 서버에 준비된 모델을 이용합니다.

## 용량과 구성

| 항목 | 다운로드 크기 |
|---|---:|
| **수업용 FLUX 구성** | **15,980,151,320 bytes · 15.98 GB (14.88 GiB)** |
| 공식 저장소 전체 | 23.74 GB |
| 선택 실습용 SlimSAM q8 | 13.79 MB |

수업용 구성은 공식 `model_index.json`에 지정된 **scheduler, text_encoder, tokenizer, transformer, vae**를 모두 포함합니다. 텍스트 인코더의 두 가중치 파일도 포함됩니다. 저장소 전체에는 다른 로더용 단일 체크포인트 7.75 GB가 추가로 들어 있어, 제공된 스크립트가 Diffusers에 필요한 20개 파일을 선택합니다.

```text
models/FLUX.2-klein-4B/
├── model_index.json
├── scheduler/
├── text_encoder/
├── tokenizer/
├── transformer/
└── vae/
```

공식 공개 모델은 Apache-2.0 라이선스이며 로그인 없이 다운로드할 수 있습니다. Python 패키지와 작업 결과를 포함해 **SSD 여유 공간 35–40 GB**를 권장합니다.

## 다운로드

프로젝트 폴더의 Python 가상환경에서 실행합니다. [환경 준비](local-setup.md)

```bash
python -m pip install -r requirements-download.txt
python scripts/download_models.py --model flux
python scripts/download_models.py --model flux --download
```

두 번째 명령은 대상 파일과 용량을 보여주고, 세 번째 명령이 다운로드를 시작합니다. 완료 후 파일 크기와 체크섬을 확인합니다.

선택 실습의 클릭 영역 분할 모델은 다음 명령으로 받습니다.

```bash
python scripts/download_models.py --model segmentation --download
```

- FLUX 저장 경로: `models/FLUX.2-klein-4B/`
- SlimSAM 저장 경로: `public/models/Xenova/slimsam-77-uniform/`

## 이어받기와 USB 확인

중단되면 같은 다운로드 명령을 다시 실행합니다. 모델 폴더의 `.cache/huggingface`에 저장된 진행 정보를 사용합니다. USB로 받은 폴더는 다음 명령으로 오프라인 검증합니다.

```bash
python scripts/download_models.py --model flux --verify
```

다른 위치에 저장했다면 경로를 지정합니다.

```bash
python scripts/download_models.py --model flux --verify --output-dir "D:/AI_models/FLUX.2-klein-4B"
```

체크섬 오류가 발견되면 `--download --force-download`로 다시 받습니다.

## 예상 시간

15.98 GB의 순수 전송시간이며 설치·검증 시간이 추가됩니다.

| 실제 다운로드 속도 | 약 소요 시간 |
|---|---:|
| 1 MB/s | 4시간 26분 |
| 10 MB/s | 26분 38초 |
| 20 MB/s | 13분 19초 |
| 50 MB/s | 5분 20초 |

`1 MB/s = 8 Mbps`입니다. 교육장에서는 여러 사람이 회선을 공유하므로 실제 속도를 확인하며 진행합니다. 다운로드 중에도 웹 화면 작업을 이어갈 수 있습니다.

## 에이전트에게 전달할 지시

> 이 문서와 `scripts/download_models.py`를 읽고 Python, 저장 공간, 다운로드 계획을 확인해줘. 개인 노트북 실행용 FLUX.2-klein-4B distilled를 제공된 스크립트로 다운로드하고, 완료 후 파일 검증 결과를 보여줘. 중단되면 같은 경로에서 이어받아줘.

## 확인 정보

확인일: 2026-10-20. 파일 목록·구성 파일·텍스트 인코더 shard index를 대조했습니다.

- [공식 Diffusers 구성](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B/blob/e7b7dc27f91deacad38e78976d1f2b499d76a294/model_index.json)
- [FLUX 파일 크기·체크섬](https://huggingface.co/api/models/black-forest-labs/FLUX.2-klein-4B/revision/e7b7dc27f91deacad38e78976d1f2b499d76a294?blobs=true) · revision `e7b7dc27f91deacad38e78976d1f2b499d76a294`
- [SlimSAM 파일 크기·체크섬](https://huggingface.co/api/models/Xenova/slimsam-77-uniform/revision/5850ab45f587c112167512ffef949107115e26a0?blobs=true) · revision `5850ab45f587c112167512ffef949107115e26a0`
