# 이미지 생성·편집 API

이미지 생성·편집 요청을 보내면 작업이 끝난 뒤 **WebP 이미지**를 반환하는 동기식 API입니다.

기존 웹 화면에서 **GPU 서버** 또는 **로컬 모델**을 선택해 같은 생성·편집 경로를 사용합니다. 아래 기본 예시는 GPU 서버 기준이며, 로컬 실행은 다음 설정을 적용합니다.

## 로컬 모델 연결

[설치·실행 안내](local-setup.md)에 따라 API를 실행한 뒤 웹 화면에서 **로컬 모델**을 선택합니다.

```text
Base URL: http://127.0.0.1:8032
Authorization: Bearer local
Content-Type: application/json
```

| 항목 | 로컬 4비트 설정 |
|---|---|
| Mac | Apple Silicon / MLX·MFLUX / 미리 변환한 4비트 모델 |
| Windows | NVIDIA CUDA / bitsandbytes NF4 |
| 생성 크기 | 기본 512×512, 각 변 64–512 및 16의 배수 |
| 편집 입력 | 참조 이미지 1–4장, 먼저 한 장으로 실습. 추론 입력은 최대 512×512로 축소 |
| 생성 설정 | 4 steps / guidance 1.0 / 한 장 |
| 동시 작업 | 한 요청씩 실행, 작업 종료 시 모델 프로세스 종료 |

```javascript
const response = await fetch('http://127.0.0.1:8032/v1/generate', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer local', 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, width: 512, height: 512, seed: 42 })
});
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.detail || `요청 실패: ${response.status}`);
}
const imageBlob = await response.blob();
```

`/health`의 `ready_workers: 1`은 요청할 준비가 됐다는 뜻입니다. `/v1/status`에서 `backend`, `busy`, `memory.available_gib`, `last_error`로 현재 상태를 확인합니다. 모델은 요청마다 불러옵니다.

메모리 보호 기준에 도달하면 **503**과 함께 `detail`에 중단 이유를 반환합니다. 웹 화면에 이 문장을 표시하고, 사용자가 앱을 정리하거나 GPU 서버 모드로 전환할 수 있게 합니다. 시작 전 사용 가능한 RAM 9 GiB, 실행 중 최소 4 GiB, Mac RSS / Windows 프로세스 전용 메모리 최대 7 GiB 등 [보호 설정](local-setup.md#메모리-보호-설정)을 유지합니다.

## GPU 서버 접속 정보

강사가 제공한 서버 주소와 키를 웹 화면에 입력합니다. 코드 예시는 `YOUR_WORKSHOP_KEY` 자리표시자를 사용합니다.

```text
Base URL: 강사가 제공하는 HTTPS 주소
Authorization: Bearer YOUR_WORKSHOP_KEY
Content-Type: application/json
ngrok-skip-browser-warning: true
```

| 경로 | 입력 | 출력 |
|---|---|---|
| `POST /v1/generate` | 텍스트와 생성 설정 | `image/webp` |
| `POST /v1/edit` | 원본·참조 이미지 1–4장 + 수정 지시문 | `image/webp` |
| `POST /v1/flux-2-klein-4b` | 이미지 유무에 따라 생성·편집 | `image/webp` |
| `GET /v1/status` | 인증 헤더 | 전체 GPU·대기열 상태 |
| `GET /v1/schema` | 인증 헤더 | OpenAPI 명세 |
| `GET /health` | 공개 상태 확인 | 준비된 작업자 수 |

## 생성

```json
{
  "prompt": "Studio product photograph of a table with a thin oak top and slender brushed-aluminum legs. The full table is visible from a three-quarter view against a white background, with soft diffused lighting.",
  "width": 1024,
  "height": 1024,
  "seed": 42,
  "output_format": "webp"
}
```

## 편집

**원본 이미지와 변경할 내용을 함께 보냅니다.** 두 번째 이후 참조 이미지는 `input_image_2`, `input_image_3`, `input_image_4`에 data URL로 넣습니다.

```json
{
  "prompt": "Change the table legs to brushed aluminum. Preserve the oak tabletop, its thickness, the camera angle, and the overall proportions.",
  "input_image": "data:image/webp;base64,REPLACE_WITH_IMAGE_BASE64",
  "seed": 42,
  "output_format": "webp"
}
```

## GPU 서버 입력값

| 필드 | 기준 |
|---|---|
| `prompt` | 원하는 결과를 설명하는 문장 |
| `input_image`…`input_image_4` | PNG/JPEG/WebP base64 또는 data URL |
| `seed` | 0…4,294,967,295 정수, 생략하면 서버에서 선택 |
| `width`, `height` | 16의 배수, 64…4096, 총 면적 최대 1,048,576픽셀 |
| `output_format` | `webp` |
| `num_inference_steps` | 기본 `4` |
| `guidance_scale` | 기본 `1.0` |

한 요청에서 한 장을 생성합니다. 생성의 기본 크기는 1024×1024이며, 편집은 크기를 생략하면 첫 이미지의 비율을 따릅니다. 입력 이미지 용량은 한 장 10 MiB, 합계 20 MiB, JSON 본문 30 MiB까지입니다.

## 브라우저 연결

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
const imageUrl = URL.createObjectURL(imageBlob);
```

키는 현재 탭의 메모리에 유지하고, 이미지와 작업 조건을 히스토리에 저장합니다. 전체 구현은 [`web/`](../web/)을 참고합니다.

## GPU 서버 상태 확인

GPU 4개에서 최대 4건을 동시에 처리하고 나머지는 대기열에서 순서대로 실행합니다. `/v1/status`는 전체 서버 상태를 보여줍니다.

| 응답 | 처리 |
|---|---|
| `401` | 접속 키 확인 |
| `413` | 입력 이미지 용량 축소 |
| `422` | 입력 필드와 해상도 확인 |
| `429` | `Retry-After` 이후 다시 접수 |
| `503` | 모델 준비 후 다시 확인 |
| `504`·네트워크 오류 | 기존 요청 처리 상태를 확인한 뒤 재시도 |

응답 헤더 `X-Seed`, `X-GPU-ID`, `X-Request-ID`, `X-Inference-Seconds`에서 작업 정보를 읽을 수 있습니다.

[공식 FLUX.2-klein-4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B) · [BFL 이미지 편집 안내](https://docs.bfl.ai/flux_2/flux2_image_editing)
