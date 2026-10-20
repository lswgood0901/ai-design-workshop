# 한양대 GPU API

강사가 제공하는 교육용 서비스입니다. BFL의 공식 입력 중 생성·편집에 필요한 필드와 일부 Diffusers 옵션을 사용하지만, **응답 방식은 자체 구현**입니다. 요청 완료 시 WebP 이미지 자체를 반환합니다.

## 접속

```text
Base URL: 강사가 제공하는 HTTPS 주소
Authorization: Bearer YOUR_WORKSHOP_KEY
Content-Type: application/json
ngrok-skip-browser-warning: true
```

`YOUR_WORKSHOP_KEY`는 동작하는 키가 아닙니다. 실제 키는 강의 슬라이드 또는 현장에서 전달합니다. 주소·키를 사용자 입력으로 받고 키를 공개 파일에 기록하지 않습니다.

| 경로 | 입력 | 출력 |
|---|---|---|
| `POST /v1/generate` | 텍스트와 선택적 설정 | `image/webp` |
| `POST /v1/edit` | 텍스트 + 참조 이미지 1–4장 | `image/webp` |
| `POST /v1/flux-2-klein-4b` | 이미지 유무로 모드 자동 선택 | `image/webp` |
| `GET /v1/status` | 인증 헤더 | 전체 GPU·대기열 상태 JSON |
| `GET /v1/schema` | 인증 헤더 | 실제 OpenAPI JSON |
| `GET /health` | 인증 불필요 | 준비된 작업자 수 |

## 생성 예제

```json
{
  "prompt": "Studio product photograph of a minimal oak table, clean white background",
  "width": 1024,
  "height": 1024,
  "seed": 42,
  "output_format": "webp"
}
```

## 편집 예제

```json
{
  "prompt": "Change only the legs to brushed aluminum. Keep the tabletop and viewpoint unchanged.",
  "input_image": "data:image/webp;base64,REPLACE_WITH_IMAGE_BASE64",
  "seed": 42,
  "output_format": "webp"
}
```

두 번째 이후 참조 이미지는 `input_image_2`, `input_image_3`, `input_image_4`로 보냅니다. URL이나 로컬 파일 경로는 지원하지 않습니다.

## 필드

| 필드 | 기준 |
|---|---|
| `prompt` | 필수, 공백만 있는 문자열 불가 |
| `input_image`…`input_image_4` | PNG/JPEG/WebP base64 또는 data URL |
| `seed` | 0…4,294,967,295 정수. 생략 시 서버 선택 |
| `width`, `height` | 16의 배수, 각각 64…4096. 출력 면적은 최대 1,048,576픽셀 |
| `output_format` | `webp` |
| `num_inference_steps` | 로컬 옵션, 기본 4. 수업에서는 기본값 유지 |
| `guidance_scale` | 로컬 옵션, 기본 1.0. distilled 모델에서는 기본값 유지 |

생성 기본값은 1024×1024입니다. 편집에서 크기를 생략하면 첫 참조 이미지 비율을 따릅니다. 한 요청에서 한 장을 생성합니다.

이미지 한 장은 최대 10 MiB, 합계 20 MiB, JSON 요청 본문은 30 MiB입니다. 큰 이미지는 전송 전에 축소합니다.

**지원하지 않는 필드:** `mask_image`, `strength`, `negative_prompt`, webhook, 임의 URL. 마스크 합성을 구현할 때는 서버 편집 결과와 원본을 클라이언트에서 별도로 합성하고, 모델의 네이티브 인페인팅과 구분해 표시합니다.

## 브라우저 코드의 핵심

```javascript
const response = await fetch(`${baseUrl}/v1/generate`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true"
  },
  body: JSON.stringify({ prompt, width: 1024, height: 1024, seed: 42 })
});
if (!response.ok) throw new Error(`요청 실패: ${response.status}`);
const imageBlob = await response.blob();
if (!imageBlob.type.startsWith("image/")) throw new Error("이미지 응답이 아닙니다.");
const imageUrl = URL.createObjectURL(imageBlob);
```

전체 구현은 `web/`를 참고합니다. 브라우저에서 반환받은 WebP를 로컬에 저장하고 히스토리에 기록합니다. 서버는 결과 이미지를 영구 보관하지 않습니다.

## 상태와 오류

- GPU 4개는 최대 4건을 동시에 추론하고 나머지는 대기합니다. 동시 접속 인원과 동시 추론 건수는 다릅니다.
- 대기열이 비어 있어도 특정 참가자의 작업 완료를 뜻하지 않습니다. `/v1/status`는 전체 상태입니다.
- `401`: 키 확인 / `413`: 입력 용량 축소 / `422`: 필드·해상도 확인
- `429`: 대기열 가득 참. `Retry-After` 후 수동 재시도
- `503`: 모델 준비 중 / `504`: 시간 초과. 작업이 계속될 수 있으므로 연속 재전송 금지
- 네트워크 실패 시에도 서버에서 추론이 시작됐을 수 있습니다. 자동 재전송하지 않습니다.

응답 메타데이터는 `X-Seed`, `X-GPU-ID`, `X-Request-ID`, `X-Inference-Seconds` 헤더에 있습니다. 추론 시간은 대기 시간과 다릅니다.

참고: [FLUX.2-klein-4B 공식 모델 카드](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B), [BFL API](https://docs.bfl.ml/).
