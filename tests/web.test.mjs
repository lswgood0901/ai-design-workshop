import test from "node:test";
import assert from "node:assert/strict";
import { buildPayload, validateConnection, validateImageFiles, compositeRGBA, publicRecord, bestMaskIndex, describeStatus, connectionForMode, LOCAL_CONNECTION } from "../web/core.mjs";
import { requestImage, getStatus } from "../web/api.mjs";

const data = "data:image/png;base64,iVBORw0KGgo=";
test("generate uses exact supported controls and excludes mask/remote references", () => {
  assert.deepEqual(buildPayload({ mode: "generate", prompt: " table ", seed: "0", size: "1024x1024" }), {
    prompt: "table", output_format: "webp", num_inference_steps: 4, guidance_scale: 1, width: 1024, height: 1024, seed: 0,
  });
  assert.throws(() => buildPayload({ mode: "generate", prompt: "x", references: [data] }));
  assert.throws(() => buildPayload({ mode: "edit", prompt: "x", references: ["https://example.com/x.png"] }));
});
test("edit maps ordered 1–4 reference fields and automatic dimensions omit width/height", () => {
  const payload = buildPayload({ mode: "edit", prompt: "change legs", references: [data, data, data, data], size: "auto" });
  assert.equal(payload.input_image, data); assert.equal(payload.input_image_4, data); assert.equal(payload.width, undefined);
  assert.throws(() => buildPayload({ mode: "edit", prompt: "x" }));
  assert.throws(() => buildPayload({ mode: "edit", prompt: "x", references: Array(5).fill(data) }));
});
test("bounds reject malformed seed, whitespace, excess output size and unsupported files", () => {
  for (const seed of ["-1", "1.2", "abc", "4294967296", "1e2"]) assert.throws(() => buildPayload({ mode: "generate", prompt: "x", seed }));
  for (const size of ["2048x2048", "1025x1024", "wat"]) assert.throws(() => buildPayload({ mode: "generate", prompt: "x", size }));
  assert.throws(() => buildPayload({ mode: "generate", prompt: " \n" }));
  assert.throws(() => validateImageFiles([{ type: "image/svg+xml", size: 100 }]));
  assert.throws(() => validateImageFiles([{ type: "image/png", size: 11 * 1024 * 1024 }]));
  assert.throws(() => validateImageFiles(Array(3).fill({ type: "image/webp", size: 8 * 1024 * 1024 })));
});
test("credentials require HTTPS except loopback and never go in exported records", () => {
  assert.deepEqual(validateConnection({ base_url: "https://example.com/", api_key: " key " }), { base_url: "https://example.com", api_key: "key" });
  assert.equal(validateConnection({ base_url: "http://localhost:8000", api_key: "x" }).base_url, "http://localhost:8000");
  for (const base_url of ["http://example.com", "https://u:p@example.com", "https://example.com?token=x", "file:///tmp/x"]) assert.throws(() => validateConnection({ base_url, api_key: "x" }));
  const record = publicRecord({ id: "1", kind: "api", api_key: "secret", connection: { api_key: "secret" }, blob: {}, prompt: "x" });
  assert.equal(JSON.stringify(record).includes("secret"), false);
});
test("local mask composite preserves black area and selects white area", () => {
  const original = [0, 10, 20, 255, 10, 20, 30, 255], edited = [100, 110, 120, 255, 110, 120, 130, 255];
  assert.deepEqual([...compositeRGBA(original, edited, [0, 0, 0, 255, 255, 255, 255, 255])], [0, 10, 20, 255, 110, 120, 130, 255]);
  assert.throws(() => compositeRGBA([0], [0], [0]));
  assert.equal(bestMaskIndex([.2, .9, .5]), 1);
});
test("real API returns WebP directly and reads seed headers", async () => {
  let captured;
  const result = await requestImage({ base_url: "https://example.com", api_key: "test-only" }, "edit", { prompt: "change", input_image: data }, {
    fetcher: async (url, options) => {
      captured = { url, options };
      return new Response(new Blob(["webp"], { type: "image/webp" }), { headers: { "Content-Type": "image/webp", "X-Seed": "42", "X-Inference-Seconds": "2.5" } });
    },
  });
  assert.equal(captured.url, "https://example.com/v1/edit");
  assert.equal(captured.options.headers.Authorization, "Bearer test-only");
  assert.equal(captured.options.credentials, "omit"); assert.equal(captured.options.redirect, "error");
  assert.equal(result.seed, "42"); assert.equal(result.elapsed_seconds, 2.5); assert.equal(await result.blob.text(), "webp");
});
test("API rejects wrong content type and reports full queue", async () => {
  const connection = { base_url: "https://example.com", api_key: "test-only" };
  await assert.rejects(requestImage(connection, "generate", {}, { fetcher: async () => new Response("<html/>", { headers: { "Content-Type": "text/html" } }) }), /이미지 대신/);
  await assert.rejects(requestImage(connection, "generate", {}, { queueWaitMs: 0, fetcher: async () => new Response('{"detail":"queue full"}', { status: 429, headers: { "Content-Type": "application/json" } }) }), /접수 대기/);
});
test("global status is not presented as a personal queue position", async () => {
  const data = { ready_workers: 4, workers: [{ state: "busy" }, { state: "ready" }], queue_size: 7 };
  assert.equal(describeStatus(data), "GPU 4개 준비 · 1개 실행 중 · 전체 대기 7건");
  const result = await getStatus({ base_url: "https://example.com", api_key: "test-only" }, { fetcher: async () => new Response(JSON.stringify(data)) });
  assert.equal(result.data.queue_size, 7);
});
test("51st client waits on explicit 429 and re-submits the same request once space is available", async () => {
  let calls = 0;
  const events = [], delays = [], bodies = [];
  const result = await requestImage({ base_url: "https://example.com", api_key: "test-only" }, "generate", { prompt: "table", seed: 7 }, {
    onQueue: state => events.push(state.state), random: () => 0,
    delay: async milliseconds => delays.push(milliseconds),
    fetcher: async (url, options) => {
      calls++; bodies.push(options.body);
      return calls === 1 ? new Response('{"detail":"full"}', { status: 429, headers: { "Retry-After": "5" } })
        : new Response("webp", { headers: { "Content-Type": "image/webp" } });
    },
  });
  assert.equal(calls, 2); assert.deepEqual(delays, [5000]); assert.deepEqual(events, ["waiting", "submitting"]);
  assert.equal(bodies[0], bodies[1]); assert.equal(await result.blob.text(), "webp");
});
test("ambiguous network failure, timeout and 5xx are not auto-retried", async () => {
  const connection = { base_url: "https://example.com", api_key: "test-only" };
  for (const failure of [new TypeError("network"), new DOMException("timeout", "TimeoutError"), 503, 504]) {
    let calls = 0;
    await assert.rejects(requestImage(connection, "generate", {}, {
      fetcher: async () => {
        calls++;
        if (typeof failure === "number") return new Response("{}", { status: failure });
        throw failure;
      },
    }));
    assert.equal(calls, 1);
  }
});
test("cancelling client-side admission wait does not submit another request", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(requestImage({ base_url: "https://example.com", api_key: "test-only" }, "generate", {}, {
    signal: controller.signal,
    onQueue: () => controller.abort(),
    fetcher: async () => { calls++; return new Response("{}", { status: 429 }); },
  }), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("local mode uses a fixed loopback connection while keeping the supplied GPU settings", () => {
  const server = { base_url: "https://example.com", api_key: "test-only" };
  assert.deepEqual(connectionForMode("api", server), server);
  assert.deepEqual(connectionForMode("local", server), LOCAL_CONNECTION);
  assert.deepEqual(connectionForMode("api", server), { base_url: "https://example.com", api_key: "test-only" });
  assert.equal(connectionForMode("mock", server), null);
  assert.throws(() => connectionForMode("other", server));
});
test("local generation and editing send 512px payloads and receive WebP", async () => {
  for (const mode of ["generate", "edit"]) {
    const references = mode === "edit" ? [data] : [];
    const payload = buildPayload({ mode, prompt: "change table", size: "512x512", references });
    const result = await requestImage(connectionForMode("local"), mode, payload, {
      fetcher: async (url, options) => {
        assert.equal(url, `http://127.0.0.1:8032/v1/${mode}`);
        assert.equal(options.headers.Authorization, "Bearer local");
        const body = JSON.parse(options.body);
        assert.equal(body.width, 512); assert.equal(body.height, 512); assert.equal(body.num_inference_steps, 4);
        assert.equal(body.input_image, mode === "edit" ? data : undefined);
        return new Response("local-webp", { headers: { "Content-Type": "image/webp", "X-Seed": "601" } });
      },
    });
    assert.equal(await result.blob.text(), "local-webp");
    assert.equal(result.seed, "601");
  }
});
test("local memory stop and busy responses preserve actionable details and require manual retry", async () => {
  for (const [status, detail] of [[503, "여유 메모리가 4 GiB 아래로 내려가 자동 중단했습니다. 앱을 닫고 다시 실행해 주세요."], [429, "로컬 작업이 실행 중입니다. 완료 후 다시 실행해 주세요."]]) {
    let calls = 0;
    await assert.rejects(requestImage(LOCAL_CONNECTION, "generate", {}, {
      fetcher: async () => { calls++; return new Response(JSON.stringify({ detail }), { status, headers: { "Content-Type": "application/json" } }); },
      delay: async () => assert.fail("Local jobs must be retried manually."),
    }), error => error.message === detail);
    assert.equal(calls, 1);
  }
});
test("local status shows readiness and memory instead of a GPU server queue", () => {
  const status = { backend: "mlx", profile: "4bit", loaded: true, memory: { available_gib: 10.5, min_start_gib: 9, min_free_gib: 4 } };
  assert.equal(describeStatus(status), "Mac · MLX 4비트 · 실행 준비 완료 · 여유 메모리 10.5 GiB");
  assert.match(describeStatus({ ...status, backend: "cuda", busy: true }), /NVIDIA · 4비트 · 이미지 처리 중/);
  assert.match(describeStatus({ ...status, loaded: false }), /로컬 모델 준비 필요/);
  assert.match(describeStatus({ ...status, memory: { available_gib: 8.5 }, last_error: "메모리 부족으로 자동 중단" }), /앱을 닫아 메모리를 확보해 주세요.*최근 중단: 메모리 부족으로 자동 중단/);
});
test("local history exports retain the run mode and omit connection credentials", () => {
  const record = publicRecord({ id: "local-1", kind: "local", mode: "edit", prompt: "change legs", parameters: { width: 512, height: 512 }, api_key: "local", connection: LOCAL_CONNECTION });
  assert.equal(record.kind, "local"); assert.equal(record.mode, "edit"); assert.equal(record.parameters.width, 512);
  assert.equal("api_key" in record, false); assert.equal("connection" in record, false);
});
