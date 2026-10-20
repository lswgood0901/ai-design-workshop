import { validateConnection, describeStatus } from "./core.mjs";

function headers(connection, accept = "application/json") {
  return { Authorization: `Bearer ${connection.api_key}`, Accept: accept, "ngrok-skip-browser-warning": "true" };
}

async function responseError(response) {
  const value = await response.json().catch(() => ({}));
  const userMessage = {
    401: "API 키를 확인해 주세요.", 403: "접근이 허용되지 않았습니다. 강사에게 문의해 주세요.",
    413: "이미지 크기가 서버 제한을 초과했습니다.", 429: "대기열이 가득 찼습니다. 잠시 후 다시 실행해 주세요.",
    503: "GPU 서버가 준비 중입니다. 강사에게 연결 상태를 확인해 주세요.",
    504: "서버의 응답 대기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
  }[response.status];
  const detail = typeof value.detail === "string" ? value.detail : "";
  return new Error(userMessage || `요청 실패 (${response.status}). ${detail || "입력값과 연결 상태를 확인해 주세요."}`);
}

export async function getStatus(connection, { fetcher = fetch, signal } = {}) {
  const valid = validateConnection(connection);
  const response = await fetcher(`${valid.base_url}/v1/status`, {
    headers: headers(valid), credentials: "omit", redirect: "error", cache: "no-store", signal,
  });
  if (!response.ok) throw await responseError(response);
  const data = await response.json();
  return { data, label: describeStatus(data) };
}

/** Existing workshop gateway is synchronous, unlike BFL's hosted async API. */
export async function requestImage(connection, mode, payload, { signal, fetcher = fetch, timeoutMs = 360000 } = {}) {
  const valid = validateConnection(connection);
  if (!["generate", "edit"].includes(mode)) throw new Error("지원하지 않는 작업 방식입니다.");
  const abort = new AbortController();
  const onAbort = () => abort.abort(signal?.reason);
  if (signal?.aborted) onAbort(); else signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => abort.abort(new DOMException("응답 대기 시간이 초과되었습니다.", "TimeoutError")), timeoutMs);
  try {
    const response = await fetcher(`${valid.base_url}/v1/${mode}`, {
      method: "POST", headers: { ...headers(valid, "image/webp"), "Content-Type": "application/json" },
      body: JSON.stringify(payload), credentials: "omit", redirect: "error", cache: "no-store", signal: abort.signal,
    });
    if (!response.ok) throw await responseError(response);
    if (response.headers.get("Content-Type")?.split(";")[0].trim() !== "image/webp") {
      throw new Error("서버가 이미지 대신 다른 응답을 보냈습니다. 주소를 확인해 주세요.");
    }
    return {
      blob: await response.blob(), seed: response.headers.get("X-Seed"),
      elapsed_seconds: Number(response.headers.get("X-Inference-Seconds")) || null,
      request_id: response.headers.get("X-Request-ID"),
    };
  } finally {
    clearTimeout(timeout); signal?.removeEventListener("abort", onAbort);
  }
}
