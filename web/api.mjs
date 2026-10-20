import { validateConnection, describeStatus } from "./core.mjs";

function headers(connection, accept = "application/json") {
  return { Authorization: `Bearer ${connection.api_key}`, Accept: accept, "ngrok-skip-browser-warning": "true" };
}

async function responseError(response) {
  const value = await response.json().catch(() => ({}));
  const userMessage = {
    401: "API 키를 확인해 주세요.", 403: "접근이 허용되지 않았습니다. 강사에게 문의해 주세요.",
    413: "이미지 크기를 줄여 다시 실행해 주세요.", 429: "GPU 서버 접수를 기다리고 있습니다.",
    503: "GPU 서버가 준비 중입니다. 강사에게 연결 상태를 확인해 주세요.",
    504: "응답 대기 시간이 초과되었습니다. 강사에게 작업 상태를 확인해 주세요.",
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

export function abortableDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(signal.reason || new DOMException("중단했습니다.", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, milliseconds);
    if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
  });
}

/** Retry only explicit 429 responses: those requests were not admitted. */
export async function requestImage(connection, mode, payload, {
  signal, fetcher = fetch, timeoutMs = 360000, queueWaitMs = 600000,
  onQueue = () => {}, delay = abortableDelay, random = Math.random, now = Date.now,
} = {}) {
  const valid = validateConnection(connection);
  if (!["generate", "edit"].includes(mode)) throw new Error("지원하지 않는 작업 방식입니다.");
  const abort = new AbortController();
  const onAbort = () => abort.abort(signal?.reason);
  if (signal?.aborted) onAbort(); else signal?.addEventListener("abort", onAbort, { once: true });
  const queueDeadline = now() + queueWaitMs;
  let timeout, attempts = 0;
  try {
    while (true) {
      if (abort.signal.aborted) throw abort.signal.reason;
      timeout = setTimeout(() => abort.abort(new DOMException("응답 대기 시간이 초과되었습니다.", "TimeoutError")), timeoutMs);
      const response = await fetcher(`${valid.base_url}/v1/${mode}`, {
        method: "POST", headers: { ...headers(valid, "image/webp"), "Content-Type": "application/json" },
        body: JSON.stringify(payload), credentials: "omit", redirect: "error", cache: "no-store", signal: abort.signal,
      });
      if (response.status === 429) {
        clearTimeout(timeout);
        await response.body?.cancel();
        const retryHeader = Number(response.headers.get("Retry-After") || 5);
        const seconds = Number.isFinite(retryHeader) ? Math.max(1, Math.min(retryHeader, 30)) : 5;
        const delayMs = seconds * 1000 + Math.floor(random() * 1000);
        if (now() + delayMs > queueDeadline) throw new Error("GPU 서버 접수 대기가 길어지고 있습니다. 강사에게 알려주세요.");
        attempts++;
        onQueue({ state: "waiting", attempt: attempts, delayMs });
        await delay(delayMs, abort.signal);
        onQueue({ state: "submitting", attempt: attempts });
        continue;
      }
      if (!response.ok) throw await responseError(response);
      if (response.headers.get("Content-Type")?.split(";")[0].trim() !== "image/webp") {
        throw new Error("서버가 이미지 대신 다른 응답을 보냈습니다. 주소를 확인해 주세요.");
      }
      return {
        blob: await response.blob(), seed: response.headers.get("X-Seed"),
        elapsed_seconds: Number(response.headers.get("X-Inference-Seconds")) || null,
        request_id: response.headers.get("X-Request-ID"),
      };
    }
  } finally {
    clearTimeout(timeout); signal?.removeEventListener("abort", onAbort);
  }
}
