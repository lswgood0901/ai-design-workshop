/** Pure request/state helpers. No credential is written to persistent storage. */
export const LOCAL_CONNECTION = Object.freeze({ base_url: "http://127.0.0.1:8032", api_key: "local" });
export function connectionForMode(mode, serverConnection) {
  if (mode === "local") return { ...LOCAL_CONNECTION };
  if (mode === "api") return validateConnection(serverConnection);
  if (mode === "mock") return null;
  throw new Error("실행 방식을 확인해 주세요.");
}
export function isLocalConnection(connection) {
  return connection?.base_url === LOCAL_CONNECTION.base_url && connection?.api_key === LOCAL_CONNECTION.api_key;
}

export const MODEL = "black-forest-labs/FLUX.2-klein-4B";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export function validateConnection(value) {
  if (!value || typeof value.base_url !== "string" || typeof value.api_key !== "string" || !value.api_key.trim()) {
    throw new Error("서버 주소와 수업용 API 키를 입력해 주세요.");
  }
  let parsed;
  try { parsed = new URL(value.base_url.trim()); } catch { throw new Error("올바른 서버 주소를 입력해 주세요."); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("서버 주소는 쿼리·로그인 정보가 없는 HTTP(S) 주소여야 합니다.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !loopback) {
    throw new Error("외부 GPU 서버는 https 주소로 연결해 주세요.");
  }
  return { base_url: parsed.href.replace(/\/+$/, ""), api_key: value.api_key.trim() };
}

export function validateImageFiles(files) {
  if (files.length > 4) throw new Error("참조 이미지는 최대 4장까지 사용할 수 있습니다.");
  let total = 0;
  for (const file of files) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("PNG, JPG 또는 WebP 파일을 선택해 주세요.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("이미지 한 장은 10 MiB 이하여야 합니다.");
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) throw new Error("참조 이미지의 합계는 20 MiB 이하여야 합니다.");
}

export function buildPayload({ mode, prompt, seed = "", size = "1024x1024", references = [] }) {
  if (!["generate", "edit"].includes(mode)) throw new Error("작업 방식을 확인해 주세요.");
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("디자인 지시문을 입력해 주세요.");
  if (prompt.length > 32768) throw new Error("지시문은 32,768자 이내로 입력해 주세요.");
  if (mode === "edit" && (!references.length || references.length > 4)) throw new Error("편집할 참조 이미지를 1~4장 추가해 주세요.");
  if (mode === "generate" && references.length) throw new Error("이미지를 사용하려면 이미지 편집으로 전환해 주세요.");
  const payload = { prompt: prompt.trim(), output_format: "webp", num_inference_steps: 4, guidance_scale: 1.0 };
  if (size !== "auto") {
    if (!/^\d+x\d+$/.test(size)) throw new Error("출력 크기를 확인해 주세요.");
    const [width, height] = size.split("x").map(Number);
    if (![width, height].every(n => Number.isInteger(n) && n >= 64 && n <= 4096 && n % 16 === 0) || width * height > 1048576) {
      throw new Error("출력 크기는 16의 배수이며 최대 1메가픽셀 이하여야 합니다.");
    }
    Object.assign(payload, { width, height });
  }
  if (seed !== "" && seed !== null && seed !== undefined) {
    const parsed = typeof seed === "number" ? seed : (/^\d+$/.test(seed) ? Number(seed) : NaN);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 4294967295) throw new Error("시드는 0~4,294,967,295의 정수로 입력해 주세요.");
    payload.seed = parsed;
  }
  references.forEach((reference, i) => {
    if (typeof reference !== "string" || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(reference)) {
      throw new Error("참조 이미지는 유효한 PNG·JPG·WebP data URL이어야 합니다.");
    }
    payload[i === 0 ? "input_image" : `input_image_${i + 1}`] = reference;
  });
  return payload;
}

export function describeStatus(data) {
  if (["mlx", "cuda"].includes(data.backend)) {
    const runtime = data.backend === "mlx" ? "Mac · MLX 4비트" : "NVIDIA · 4비트";
    const memory = data.memory || {};
    const available = memory.available_gib == null ? NaN : Number(memory.available_gib);
    const memoryLabel = Number.isFinite(available) ? ` · 여유 메모리 ${available.toFixed(1)} GiB` : "";
    const ready = data.loaded === true;
    const status = data.busy ? "이미지 처리 중" : !ready ? "로컬 모델 준비 필요" : available < Number(memory.min_start_gib ?? 9) ? "앱을 닫아 메모리를 확보해 주세요" : "실행 준비 완료";
    const lastError = typeof data.last_error === "string" && data.last_error ? ` · 최근 중단: ${data.last_error}` : "";
    return `${runtime} · ${status}${memoryLabel}${lastError}`;
  }
  const workers = Array.isArray(data.workers) ? data.workers : [];
  const busy = workers.filter(w => w.state === "busy").length;
  const ready = Number(data.ready_workers) || 0;
  const queued = Number(data.queue_size) || 0;
  return `GPU ${ready}개 준비 · ${busy}개 실행 중 · 전체 대기 ${queued}건`;
}

export function publicRecord(record) {
  return {
    id: record.id, created_at: record.created_at, mode: record.mode, kind: record.kind,
    model: record.kind === "mock" ? null : MODEL, prompt: record.prompt,
    parameters: record.parameters, seed: record.seed, elapsed_seconds: record.elapsed_seconds,
    reference_count: record.reference_count, mask_composite: !!record.mask_composite,
    note: record.kind === "mock" ? "Interface test only. Not AI generated." : undefined,
  };
}

export function bestMaskIndex(scores) {
  if (!scores.length) throw new Error("분할 결과가 없습니다.");
  let index = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[index]) index = i;
  return index;
}

/** Mask red channel 0..255: white selects edited pixels; black preserves original. */
export function compositeRGBA(original, edited, mask) {
  if (original.length !== edited.length || original.length !== mask.length || original.length % 4) throw new Error("합성 이미지의 크기가 일치하지 않습니다.");
  const output = new Uint8ClampedArray(original.length);
  for (let i = 0; i < output.length; i += 4) {
    const alpha = mask[i] / 255;
    for (let c = 0; c < 3; c++) output[i + c] = Math.round(original[i + c] * (1 - alpha) + edited[i + c] * alpha);
    output[i + 3] = 255;
  }
  return output;
}
