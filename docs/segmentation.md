# 이미지 영역 선택: SlimSAM + 브러시

이번 수업의 이미지 영역 선택은 **SlimSAM의 클릭 기반 분할**과 **브러시 수정**으로 구성합니다. FLUX와 별개인 작은 모델이며 Windows/Mac 브라우저의 WASM에서 실행합니다. NVIDIA GPU, CUDA, PyTorch를 요구하지 않습니다.

## 모델과 저장 위치

- 저장소: [`Xenova/slimsam-77-uniform`](https://huggingface.co/Xenova/slimsam-77-uniform)
- 고정 revision: `5850ab45f587c112167512ffef949107115e26a0`
- 구성: q8 `vision_encoder_quantized.onnx` + `prompt_encoder_mask_decoder_quantized.onnx`, 설정 2개, README
- 모델 다운로드: **13,789,807 bytes = 13.79 MB**
- 라이브러리: `@huggingface/transformers@3.8.1`, WASM 실행
- 로컬 경로: `public/models/Xenova/slimsam-77-uniform/`

```bash
python -m pip install -r requirements-download.txt
python scripts/download_models.py --model segmentation --download
```

이후 프로젝트 루트에서 제공된 웹 서버를 켭니다. 웹 파일과 모델 폴더만 노출합니다. `file://`로 HTML을 직접 더블클릭하면 모듈과 모델 로딩이 차단될 수 있습니다.

```bash
python scripts/serve.py
```

브라우저: `http://127.0.0.1:8000/`

다운로드 스크립트가 받는 13.79 MB는 **모델 자산만**의 크기입니다. 브라우저가 처음 불러오는 Transformers.js·ONNX Runtime/WASM 라이브러리의 전송량은 별도입니다. CDN 접근이 막히거나 WASM 초기화가 실패하면 브러시로 마스크를 만듭니다. 완전한 오프라인 실행은 라이브러리도 별도 배포해야 하므로 USB 모델 복사만으로 보장하지 않습니다.

## 참가자 작업 흐름

1. 편집할 이미지를 업로드합니다.
2. 객체/부위를 클릭하여 포함할 점을 지정합니다. 잘못 포함된 부분에는 제외할 점을 추가합니다.
3. 자동 분할 결과를 확인하고 브러시의 더하기/지우기로 수정합니다.
4. 마스크를 PNG로 저장하거나 결과 합성에 사용합니다.

브라우저의 화면 좌표는 원본 이미지 픽셀 좌표로 변환되어야 합니다. 웹 화면에서 이미지를 축소했더라도 출력 마스크의 해상도는 원본과 같아야 합니다. 최종 이진 마스크는 **흰색=선택 영역, 검정=유지 영역**으로 정의합니다.

## FLUX 편집 API와 마스크를 혼동하지 않습니다

이번 한양대 GPU 서버의 FLUX.2-klein-4B API는 `prompt`와 참조 이미지를 사용한 생성/편집을 제공합니다. **`mask`, `mask_image`, `strength` 입력은 지원하지 않습니다.** 존재하지 않는 필드를 서버에 보내면 검증 오류가 납니다.

마스크의 용도는 다음처럼 설명합니다.

- **선택 부위 기록**: 디자이너가 바꾸려는 영역을 시각적으로 표시하고 저장합니다.
- **선택적 결과 합성**: 편집 결과를 받은 뒤, 원본 이미지와 결과 이미지를 마스크로 브라우저에서 합성합니다. 마스크 바깥의 원본 픽셀을 유지할 수 있습니다.

두 번째 방식은 **모델이 마스크를 조건으로 생성하는 인페인팅과 다릅니다**. FLUX가 내부적으로 선택 영역만 생성했다거나 선택 밖을 보존했다고 설명하면 안 됩니다. 원본과 편집 결과의 구도나 물체 위치가 달라지면 경계가 어색할 수 있고, 형태가 선택 영역 밖으로 확장되는 수정에는 적합하지 않을 수 있습니다. 출력 크기가 원본과 다르면 합성 전 리사이즈/정렬 기준을 명확하게 적용해야 합니다.

## 구현 시 에이전트가 지킬 사항

- 분할 모델은 별도 버튼으로 준비하고 진행 상태를 표시합니다. 모델 준비 전에도 업로드·브러시·히스토리는 사용할 수 있어야 합니다.
- `SamModel`과 `AutoProcessor`를 사용합니다. 양자화 ONNX 경로에 맞춰 `dtype: 'q8'`, `device: 'wasm'`를 지정합니다.
- 로컬 모델 경로를 `/public/models/`로 설정하고 원격 모델의 임의 추가 다운로드는 끕니다.
- 모델 최초 로딩/이미지 임베딩 생성이 느릴 수 있습니다. 같은 이미지의 클릭을 바꿀 때는 임베딩을 재사용할 수 있도록 구현합니다.
- 포함 점은 label `1`, 제외 점은 label `0`입니다. 반환된 복수 마스크는 점수/사용자 선택에 따라 하나를 사용합니다.
- 로드 실패 시 원인과 브러시 대안을 표시합니다. 조용히 빈 마스크를 성공한 것처럼 보여주지 않습니다.
- 마스크나 이미지, 수업 API 키를 Git에 커밋하지 않습니다.
- SAM 3D와 SlimSAM은 다른 모델입니다. **3D 생성은 Meta Playground에서 별도로 진행**하며 SAM 3D를 개인 노트북에 설치하지 않습니다.

## 공식·원저자 자료

- [SlimSAM ONNX 모델 카드와 사용 예](https://huggingface.co/Xenova/slimsam-77-uniform)
- [SlimSAM 원본 모델](https://huggingface.co/nielsr/slimsam-77-uniform)
- [Transformers.js SAM API](https://huggingface.co/docs/transformers.js/en/api/models#models.SamModel)
- [Transformers.js 커스텀/로컬 모델 설정](https://huggingface.co/docs/transformers.js/en/custom_usage)
