# 2단계 · 모델 연결

## GPU 서버

강사가 제공한 주소와 접속 키를 웹 화면에 입력합니다.

```text
docs/api.md에 맞춰 지금 만든 화면에 GPU 서버 연결을 추가해줘.
서버 주소와 키를 화면에서 입력받고 키는 현재 탭 메모리에 유지해줘.
POST /v1/generate와 /v1/edit를 사용하고 WebP 응답을 이미지로 표시해줘.
편집은 원본 이미지를 input_image의 data URL로 보내고 수정 프롬프트를 함께 전달해줘.
한 번에 한 요청을 실행하고 결과를 히스토리에 저장해줘.
생성 한 번과 원본 이미지+프롬프트 편집 한 번으로 확인해줘.
```

## 개인 노트북

```text
docs/local-setup.md를 따라 다운로드한 models/FLUX.2-klein-4B를 연결해줘.
Windows NVIDIA는 CUDA, Apple Silicon Mac은 MPS 환경을 사용해줘.
제공된 scripts/local_api.py와 requirements-local.txt를 참고해 로컬 API를 실행해줘.
입력·출력은 docs/api.md에 맞추고 웹 화면에서 접속하게 해줘.
512×512 한 장 생성과 이미지+프롬프트 편집으로 실제 동작을 확인해줘.
사용한 패키지 버전과 실행 결과를 알려줘.
```

## 영어 프롬프트 정리

```text
docs/design-brief.md를 참고해 내 한국어 디자인 요구를 영어 프롬프트로 정리해줘.
생성은 제품 형태·소재·시점·조명을, 편집은 변경할 부분과 유지할 부분을 구체적으로 적어줘.
영어 프롬프트와 그 의미를 설명하는 한국어 문장을 함께 보여줘.
```
