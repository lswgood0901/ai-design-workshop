# 선택 실습 · 영역 선택과 합성

**영역 합성은 편집 결과 중 선택한 부위를 원본에 합치는 기능입니다. 표면의 색상·소재 변경에 활용합니다.** 기본 편집은 원본 이미지와 수정 지시문으로 진행하고, 필요할 때 영역 합성을 추가합니다.

## 사용 순서

1. 편집할 원본 이미지를 올립니다.
2. `영역 합성 (선택)`을 열고 클릭 또는 브러시로 부위를 선택합니다.
3. 수정 지시문으로 편집 결과를 생성합니다.
4. 선택한 영역에 편집 결과를 합성하고 최종 이미지를 저장합니다.

브러시는 바로 사용할 수 있습니다. 클릭 기반 자동 선택에는 SlimSAM을 준비합니다.

```bash
python -m pip install -r requirements-download.txt
python scripts/download_models.py --model segmentation --download
python scripts/serve.py
```

브라우저에서 `http://127.0.0.1:8000/`을 열고 `SlimSAM 로드`를 누릅니다. 포함할 점과 제외할 점으로 선택 영역을 조정하고 브러시로 다듬습니다. 선택 영역은 PNG로도 저장할 수 있습니다.

## 구현 정보

- 모델: `Xenova/slimsam-77-uniform`, q8 · **13.79 MB**
- 실행: Transformers.js 3.8.1, 브라우저 WASM
- 저장 위치: `public/models/Xenova/slimsam-77-uniform/`
- 원본 크기의 마스크: 흰색은 선택 영역, 검정은 유지 영역
- 편집 요청: 원본 이미지와 수정 프롬프트
- 결과 처리: 브라우저에서 선택 영역을 기준으로 원본과 편집 결과를 합성

처음 실행할 때 JavaScript/WASM 라이브러리도 다운로드합니다. 모델 준비 상태를 화면에 표시하고, 준비 중에는 브러시를 사용할 수 있게 합니다.

[모델 카드](https://huggingface.co/Xenova/slimsam-77-uniform) · [Transformers.js SAM](https://huggingface.co/docs/transformers.js/en/api/models#models.SamModel)
