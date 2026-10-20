import test from "node:test";
import assert from "node:assert/strict";
import { buildPayload, validateConnection, validateImageFiles, compositeRGBA, publicRecord, bestMaskIndex, describeStatus } from "../web/core.mjs";
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
  await assert.rejects(requestImage(connection, "generate", {}, { fetcher: async () => new Response('{"detail":"queue full"}', { status: 429, headers: { "Content-Type": "application/json" } }) }), /대기열/);
});
test("global status is not presented as a personal queue position", async () => {
  const data = { ready_workers: 4, workers: [{ state: "busy" }, { state: "ready" }], queue_size: 7 };
  assert.equal(describeStatus(data), "GPU 4개 준비 · 1개 실행 중 · 전체 대기 7건");
  const result = await getStatus({ base_url: "https://example.com", api_key: "test-only" }, { fetcher: async () => new Response(JSON.stringify(data)) });
  assert.equal(result.data.queue_size, 7);
});
