# 휴식 시간 · 로컬 모델 다운로드

개인 노트북에서 FLUX를 실행할 참가자가 사용합니다. GPU 서버 참가자는 화면 작업을 이어갑니다.

```text
docs/local-setup.md와 docs/model-download.md를 읽고 내 환경을 점검해줘.
운영체제, GPU/메모리, 드라이버, 저장공간을 확인해줘.
로컬 실행 경로에 맞춰 scripts/download_models.py로 다운로드해줘.
Apple Silicon Mac은 --model flux-mlx로 MLX 4비트 구성(약 4.62 GB)을,
Windows NVIDIA는 --model flux로 Diffusers 구성(약 15.98 GB)을 준비해줘.
이미 다운로드한 호환 폴더가 있으면 그 경로를 재사용하고 파일 검증부터 해줘.
안내된 모델 폴더와 고정 revision을 사용하고 완료 후 파일을 검증해줘.
드라이버 설치나 재부팅이 필요하면 적용 전에 설명해줘.
```

```text
다운로드 상태와 남은 항목을 확인해줘.
중단된 경우 같은 경로에서 이어받아줘.
준비 중인 화면과 히스토리를 유지하면서 다음 실습을 이어가자.
```
