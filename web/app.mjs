import { buildPayload, validateConnection, validateImageFiles, compositeRGBA, publicRecord } from "./core.mjs";
import { requestImage, getStatus } from "./api.mjs";
import { listHistory, saveHistory, deleteHistory } from "./history.mjs";
import { loadSegmentation, segmentImage } from "./segmentation.mjs";

const $ = id => document.getElementById(id);
const state = {
  mode: "generate", runMode: "mock", connection: null, references: [], records: [],
  current: null, busy: false, controller: null, mask: null, persisted: true,
};
let outputURL, historyURLs = [], timer, pollTimer, polling = false;
const example = {
  generate: "A contemporary side table with a rounded rectangular solid ash wood top and two curved brushed aluminum legs. A restrained, balanced silhouette, visible material texture, three-quarter front view, centered on a neutral light gray studio background, soft diffused lighting, no text, no dimension labels.",
  edit: "Change only the table legs to brushed aluminum with a smooth curved profile. Preserve the tabletop, overall proportions, camera angle, lighting, and background.",
};
const toDataURL = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다.")); reader.readAsDataURL(blob);
});
const imageFrom = source => new Promise((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("이미지를 표시하지 못했습니다.")); image.src = source;
});
const canvasBlob = (canvas, type = "image/webp") => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("이미지 저장에 실패했습니다.")), type, 0.95));
const dateLabel = iso => new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
function message(text, type = "success") { $("message").textContent = text; $("message").className = `message ${type}`; $("message").hidden = !text; }
function download(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const recordFilename = record => `${record.kind === "mock" ? "UI_TEST" : "flux-design"}-${record.id.slice(0, 8)}`;

function setMode(mode) {
  if (state.busy) return;
  state.mode = mode;
  ["generate", "edit"].forEach(value => $(`tab-${value}`).setAttribute("aria-selected", String(mode === value)));
  $("reference-section").hidden = mode !== "edit";
  $("prompt-help").textContent = mode === "generate"
    ? "대상·형태·소재·색상·구도를 구체적으로 입력하세요."
    : "원본 이미지에서 바꿀 부분과 유지할 부분을 함께 설명하세요.";
  updateRunMode();
}
function updateRunMode() {
  const api = state.runMode === "api";
  $("connection-label").textContent = api ? "GPU 서버 연결" : "인터페이스 실습 모드";
  $("connection-dot").classList.toggle("live", api);
  $("mode-notice").classList.toggle("api", api);
  $("mode-notice").replaceChildren();
  const title = document.createElement("strong"), detail = document.createElement("span");
  title.textContent = api ? "FLUX.2 [klein] 4B" : "인터페이스 실습 모드";
  detail.textContent = api ? "원본 이미지와 지시문으로 디자인을 생성·편집합니다. GPU 서버에서 접수한 순서대로 처리합니다." : "입력·미리보기·히스토리를 구성한 뒤 GPU 서버에 연결합니다.";
  $("mode-notice").append(title, detail);
  $("submit-label").textContent = api ? (state.mode === "edit" ? "이미지 편집" : "이미지 생성") : "인터페이스 테스트";
  if (!api) $("server-status").textContent = "입력과 결과 기록의 작동을 확인합니다.";
}
function setBusy(value) {
  state.busy = value;
  $("loading-state").hidden = !value;
  $("cancel-button").hidden = !value || state.runMode !== "api";
  $("connection-open").disabled = value;
  for (const control of $("design-form").querySelectorAll("button, input, select, textarea")) {
    control.disabled = value;
  }
  $("cancel-button").disabled = false;
  if (!value) {
    $("mask-open").disabled = state.references.length === 0;
    $("composite").disabled = !state.mask;
  }
  for (const button of document.querySelectorAll(".history-card-actions button")) button.disabled = value;
  $("reuse-output").disabled = value || !state.current;
}

async function refreshStatus() {
  if (!state.connection || state.runMode !== "api" || polling) return;
  polling = true;
  try {
    const result = await getStatus(state.connection, { signal: AbortSignal.timeout(10000) });
    $("server-status").textContent = result.label;
  } catch (error) {
    $("server-status").textContent = error.name === "TimeoutError" ? "서버 상태 확인 시간이 초과되었습니다." : `상태 확인: ${error.message}`;
  } finally { polling = false; }
}
function startPolling() {
  clearInterval(pollTimer);
  if (state.runMode === "api") { refreshStatus(); pollTimer = setInterval(refreshStatus, 6000); }
}

function renderReferences() {
  $("reference-list").replaceChildren();
  state.references.forEach((reference, index) => {
    const tile = document.createElement("div"); tile.className = "reference-tile";
    const image = document.createElement("img"); image.src = reference.url; image.alt = `참조 이미지 ${index + 1}`;
    const label = document.createElement("small"); label.textContent = String(index + 1);
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", `참조 이미지 ${index + 1} 삭제`);
    remove.onclick = () => {
      URL.revokeObjectURL(reference.url); state.references.splice(index, 1);
      if (index === 0) clearAppliedMask(); renderReferences();
    };
    tile.append(image, label, remove); $("reference-list").append(tile);
  });
  $("reference-count").textContent = `${state.references.length} / 4`;
  $("mask-open").disabled = !state.references.length || state.busy;
}
function clearAppliedMask() {
  state.mask = null; $("composite").checked = false; $("composite").disabled = true;
  $("mask-open").textContent = "첫 번째 이미지의 영역 선택 ↗";
}
async function addReferences(files, replace = false) {
  const existing = replace ? [] : state.references.map(item => item.blob);
  validateImageFiles([...existing, ...files]);
  const added = [];
  try {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const image = await imageFrom(url);
        if (image.naturalWidth < 16 || image.naturalHeight < 16 || image.naturalWidth * image.naturalHeight > 16777216) throw new Error("이미지는 가로·세로 16px 이상, 총 16메가픽셀 이하여야 합니다.");
        added.push({ blob: file, url, name: file.name || "output.webp", width: image.naturalWidth, height: image.naturalHeight });
      } catch (error) { URL.revokeObjectURL(url); throw error; }
    }
  } catch (error) { added.forEach(item => URL.revokeObjectURL(item.url)); throw error; }
  if (replace) { state.references.forEach(item => URL.revokeObjectURL(item.url)); state.references = []; clearAppliedMask(); }
  state.references.push(...added); renderReferences();
}

async function mockImage(payload) {
  const canvas = document.createElement("canvas");
  canvas.width = payload.width || 1024; canvas.height = payload.height || 1024;
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#252525"; ctx.fillRect(0, 0, w, h);
  if (state.mode === "edit" && state.references[0]) {
    const image = await imageFrom(state.references[0].url);
    const scale = Math.min(w / image.width, h / image.height);
    ctx.drawImage(image, (w - image.width * scale) / 2, (h - image.height * scale) / 2, image.width * scale, image.height * scale);
    ctx.fillStyle = "#181818a0"; ctx.fillRect(0, 0, w, h);
  } else {
    ctx.strokeStyle = "#555550"; ctx.lineWidth = w / 600;
    const x = w * .23, y = h * .39, tw = w * .54, th = h * .12;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + tw * .73, y - th); ctx.lineTo(x + tw, y); ctx.lineTo(x + tw * .27, y + th); ctx.closePath(); ctx.stroke();
    for (const [px, py] of [[x, y], [x + tw, y], [x + tw * .27, y + th]]) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + h * .25); ctx.stroke(); }
  }
  ctx.textAlign = "center"; ctx.fillStyle = "#eeeeea"; ctx.font = `500 ${w * .024}px sans-serif`; ctx.fillText("INTERFACE PREVIEW", w / 2, h * .78);
  ctx.font = `${w * .014}px sans-serif`; ctx.fillStyle = "#a6a69d"; ctx.fillText("UI TEST ONLY / NOT AI GENERATED", w / 2, h * .815);
  return canvasBlob(canvas);
}

async function compositeResult(blob, reference, mask) {
  const generatedURL = URL.createObjectURL(blob), maskURL = URL.createObjectURL(mask);
  try {
    const [generated, original, selected] = await Promise.all([imageFrom(generatedURL), imageFrom(reference.url), imageFrom(maskURL)]);
    const ratioDifference = Math.abs(generated.width / generated.height - original.width / original.height);
    if (ratioDifference > .025) throw new Error("원본과 결과의 비율이 달라 영역 합성을 생략했습니다. 출력 비율을 ‘참조 이미지 기준 자동’으로 설정해 주세요.");
    const canvas = document.createElement("canvas"); canvas.width = generated.width; canvas.height = generated.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const pixels = image => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; };
    const result = compositeRGBA(pixels(original), pixels(generated), pixels(selected));
    ctx.putImageData(new ImageData(result, canvas.width, canvas.height), 0, 0);
    return canvasBlob(canvas);
  } finally { URL.revokeObjectURL(generatedURL); URL.revokeObjectURL(maskURL); }
}

async function run(event) {
  event.preventDefault(); if (state.busy) return; message("");
  let payload;
  try {
    const references = state.mode === "edit" ? await Promise.all(state.references.map(reference => toDataURL(reference.blob))) : [];
    payload = buildPayload({ mode: state.mode, prompt: $("prompt").value, size: $("size").value, seed: $("seed").value, references });
    if (state.runMode === "api") validateConnection(state.connection);
  } catch (error) { message(error.message, "error"); return; }
  const mode = state.mode, kind = state.runMode, original = state.references[0], mask = state.mask;
  const applyMask = mode === "edit" && $("composite").checked && !!mask && kind === "api";
  setBusy(true);
  const started = performance.now();
  $("loading-title").textContent = kind === "mock" ? "인터페이스 테스트 미리보기를 만듭니다." : "서버의 이미지 응답을 기다리고 있습니다.";
  $("elapsed").textContent = "0초"; timer = setInterval(() => $("elapsed").textContent = `${Math.floor((performance.now() - started) / 1000)}초 경과`, 1000);
  state.controller = new AbortController();
  try {
    const result = kind === "mock" ? { blob: await mockImage(payload), seed: null, elapsed_seconds: null } :
      await requestImage(state.connection, mode, payload, {
        signal: state.controller.signal,
        onQueue: status => {
          $("loading-title").textContent = status.state === "waiting"
            ? `GPU 서버 접수 대기 중 · ${Math.ceil(status.delayMs / 1000)}초 뒤 자동 접수`
            : "GPU 서버에 요청을 접수하고 있습니다.";
        },
      });
    let output = result.blob, composited = false, warning = "";
    if (applyMask) {
      try { output = await compositeResult(output, original, mask); composited = true; }
      catch (error) { warning = error.message; }
    }
    const params = Object.fromEntries(Object.entries(payload).filter(([key]) => !key.startsWith("input_image") && key !== "prompt"));
    const record = {
      id: crypto.randomUUID(), created_at: new Date().toISOString(), mode, kind,
      prompt: payload.prompt, parameters: params, seed: result.seed ?? payload.seed ?? null,
      elapsed_seconds: result.elapsed_seconds, reference_count: mode === "edit" ? state.references.length : 0,
      mask_composite: composited, blob: output,
    };
    state.records.unshift(record);
    try { await saveHistory(record); } catch { state.persisted = false; warning += " 브라우저 저장 공간이 부족하거나 저장이 차단되었습니다. 결과를 파일로 내려받아 주세요."; }
    renderHistory(); showRecord(record);
    message(warning || (kind === "mock" ? "인터페이스 테스트가 완료되었습니다. 이 이미지는 AI 생성 결과가 아닙니다." : composited ? "선택 영역에 생성 결과를 합성했습니다. 경계와 구조를 확인해 주세요." : "이미지 생성이 완료되었습니다. 결과를 검토하고 다음 지시문을 작성하세요."), warning ? "error" : "success");
  } catch (error) {
    if (state.controller.signal.aborted) message("응답 대기를 중단했습니다. 이미 접수된 서버 작업은 계속 실행될 수 있습니다.", "error");
    else if (error.name === "AbortError" || error.name === "TimeoutError") message("응답 대기 시간이 초과되었습니다. 서버 작업이 계속 진행 중일 수 있습니다. 강사에게 확인해 주세요.", "error");
    else message(error instanceof TypeError ? "서버에 연결하지 못했습니다. 주소·네트워크·서버의 CORS 설정을 확인해 주세요." : error.message, "error");
  } finally { clearInterval(timer); setBusy(false); state.controller = null; refreshStatus(); }
}
function showRecord(record) {
  state.current = record;
  if (outputURL) URL.revokeObjectURL(outputURL); outputURL = URL.createObjectURL(record.blob);
  $("output-image").src = outputURL; $("output-image").hidden = false; $("empty-state").hidden = true;
  $("mock-watermark").hidden = record.kind !== "mock";
  $("preview-meta").textContent = record.kind === "mock" ? "INTERFACE TEST" : `${record.mode.toUpperCase()} · WEBP`;
  $("output-caption").textContent = record.kind === "mock" ? "UI 테스트 미리보기 · AI 생성 아님" : `${record.mask_composite ? "영역 합성 · " : ""}${record.seed !== null ? `Seed ${record.seed}` : "WebP 이미지"}${record.elapsed_seconds ? ` · ${record.elapsed_seconds.toFixed(1)}초 추론` : ""}`;
  $("reuse-output").disabled = state.busy; $("download-output").disabled = false; $("download-record").disabled = false;
  document.querySelectorAll(".history-card").forEach(card => card.classList.toggle("selected", card.dataset.id === record.id));
}
async function reuseRecord(record) {
  try {
    await addReferences([record.blob], true); setMode("edit"); $("prompt").value = ""; $("size").value = "auto";
    $("prompt").focus(); $("design-form").scrollIntoView({ block: "nearest", behavior: "smooth" });
    message(record.kind === "mock" ? "테스트 이미지를 편집 입력으로 가져왔습니다. 실제 생성 결과가 아님을 확인해 주세요." : "선택한 결과를 첫 번째 참조 이미지로 가져왔습니다. 편집 지시문을 입력하세요.");
  } catch (error) { message(error.message, "error"); }
}
function renderHistory() {
  historyURLs.forEach(URL.revokeObjectURL); historyURLs = [];
  $("history-list").replaceChildren(); $("history-empty").hidden = state.records.length > 0;
  $("history-count").textContent = String(state.records.length).padStart(2, "0");
  for (const record of state.records) {
    const card = document.createElement("article"); card.className = "history-card"; card.dataset.id = record.id;
    const preview = document.createElement("button"); preview.className = "history-thumb"; preview.setAttribute("aria-label", `${record.prompt.slice(0, 50)} 결과 보기`);
    const image = document.createElement("img"), url = URL.createObjectURL(record.blob); historyURLs.push(url); image.src = url; image.alt = record.prompt; image.loading = "lazy";
    const badge = document.createElement("span"); badge.className = "history-badge"; badge.textContent = record.kind === "mock" ? "UI TEST" : record.mask_composite ? "EDIT + COMPOSITE" : record.mode.toUpperCase();
    preview.append(image, badge); preview.onclick = () => showRecord(record);
    const title = document.createElement("h3"); title.textContent = record.prompt; title.title = record.prompt;
    const meta = document.createElement("p"); meta.textContent = dateLabel(record.created_at);
    const actions = document.createElement("div"); actions.className = "history-card-actions";
    const reuse = document.createElement("button"); reuse.textContent = "입력으로 사용"; reuse.onclick = () => reuseRecord(record);
    const prompt = document.createElement("button"); prompt.textContent = "지시문"; prompt.onclick = () => { $("prompt").value = record.prompt; $("seed").value = record.seed ?? ""; message("지시문과 시드를 입력창에 불러왔습니다."); };
    const remove = document.createElement("button"); remove.textContent = "삭제"; remove.onclick = async () => {
      if (!confirm("이 기록을 브라우저에서 삭제할까요? 이미 내려받은 파일은 유지됩니다.")) return;
      try { await deleteHistory(record.id); } catch (error) { message("저장된 기록을 삭제하지 못했습니다.", "error"); return; }
      state.records = state.records.filter(value => value.id !== record.id); renderHistory();
      if (state.current?.id === record.id) {
        if (state.records.length) showRecord(state.records[0]);
        else { state.current = null; $("output-image").hidden = true; $("empty-state").hidden = false; $("mock-watermark").hidden = true; $("preview-meta").textContent = "NO OUTPUT YET"; ["reuse-output", "download-output", "download-record"].forEach(id => $(id).disabled = true); }
      }
    };
    actions.append(reuse, prompt, remove); card.append(preview, title, meta, actions); $("history-list").append(card);
  }
}

// Connection credentials remain only in state and the input element for this tab.
$("connection-open").onclick = () => {
  $("run-mode").value = state.runMode; $("api-fields").hidden = state.runMode !== "api";
  $("server-url").value = state.connection?.base_url || ""; $("api-key").value = state.connection?.api_key || "";
  $("connection-error").hidden = true; $("connection-dialog").showModal();
};
$("run-mode").onchange = () => $("api-fields").hidden = $("run-mode").value !== "api";
$("connection-form").onsubmit = event => {
  event.preventDefault();
  try {
    const mode = $("run-mode").value;
    const connection = mode === "api" ? validateConnection({ base_url: $("server-url").value, api_key: $("api-key").value }) : null;
    state.runMode = mode; state.connection = connection; $("connection-dialog").close(); updateRunMode(); startPolling(); message("");
    if (!connection) $("api-key").value = "";
  } catch (error) { $("connection-error").textContent = error.message; $("connection-error").hidden = false; }
};
$("connection-file").onchange = async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 16384) throw new Error("연결 파일의 크기가 너무 큽니다.");
    const value = validateConnection(JSON.parse(await file.text()));
    $("server-url").value = value.base_url; $("api-key").value = value.api_key; $("connection-error").hidden = true;
  } catch (error) { $("connection-error").textContent = error instanceof SyntaxError ? "JSON 연결 파일을 읽을 수 없습니다." : error.message; $("connection-error").hidden = false; }
  event.target.value = "";
};
for (const button of document.querySelectorAll(".dialog-close")) button.onclick = () => button.closest("dialog").close();
for (const tab of document.querySelectorAll("[data-mode]")) {
  tab.onclick = () => setMode(tab.dataset.mode);
  tab.onkeydown = event => {
    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault(); setMode(state.mode === "generate" ? "edit" : "generate"); $(`tab-${state.mode}`).focus();
    }
  };
}
$("example-prompt").onclick = () => { $("prompt").value = example[state.mode]; $("prompt").focus(); };
$("design-form").onsubmit = run;
$("cancel-button").onclick = () => state.controller?.abort();
$("image-input").onchange = async event => { try { await addReferences([...event.target.files]); message(""); } catch (error) { message(error.message, "error"); } event.target.value = ""; };
$("reuse-output").onclick = () => state.current && reuseRecord(state.current);
$("download-output").onclick = () => state.current && download(state.current.blob, `${recordFilename(state.current)}.webp`);
$("download-record").onclick = () => state.current && download(new Blob([JSON.stringify(publicRecord(state.current), null, 2)], { type: "application/json" }), `${recordFilename(state.current)}.json`);

// Mask editing is independent of the FLUX API. It exports a PNG or composites locally.
const maskCanvas = $("mask-canvas"), maskDisplay = maskCanvas.getContext("2d");
const selectionCanvas = document.createElement("canvas"), selection = selectionCanvas.getContext("2d", { willReadFrequently: true });
let maskImage, drawing = false, previousPoint, samPoints = [], samLabels = [], samBusy = false, samReady = false, maskSession = 0;
function paintMask() {
  if (!maskImage) return;
  maskDisplay.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskDisplay.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
  const pixels = selection.getImageData(0, 0, selectionCanvas.width, selectionCanvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) { const selected = pixels.data[i]; pixels.data[i] = 242; pixels.data[i + 1] = 232; pixels.data[i + 2] = 215; pixels.data[i + 3] = selected ? 115 : 0; }
  const overlay = document.createElement("canvas"); overlay.width = maskCanvas.width; overlay.height = maskCanvas.height; overlay.getContext("2d").putImageData(pixels, 0, 0); maskDisplay.drawImage(overlay, 0, 0);
  samPoints.forEach((point, index) => {
    const x = point[0] / maskImage.naturalWidth * maskCanvas.width, y = point[1] / maskImage.naturalHeight * maskCanvas.height;
    maskDisplay.fillStyle = samLabels[index] ? "#ffffff" : "#e29a90";
    maskDisplay.beginPath(); maskDisplay.arc(x, y, Math.max(5, maskCanvas.width / 200), 0, Math.PI * 2); maskDisplay.fill();
  });
}
function resetMaskCanvas() {
  selection.fillStyle = "#000"; selection.fillRect(0, 0, selectionCanvas.width, selectionCanvas.height);
  samPoints = []; samLabels = []; paintMask();
}
$("mask-open").onclick = async () => {
  try {
    maskSession++;
    maskImage = await imageFrom(state.references[0].url);
    const scale = Math.min(1, 1600 / Math.max(maskImage.width, maskImage.height));
    maskCanvas.width = selectionCanvas.width = Math.round(maskImage.width * scale);
    maskCanvas.height = selectionCanvas.height = Math.round(maskImage.height * scale);
    resetMaskCanvas();
    if (state.mask) { const url = URL.createObjectURL(state.mask); const saved = await imageFrom(url); selection.drawImage(saved, 0, 0, selectionCanvas.width, selectionCanvas.height); URL.revokeObjectURL(url); paintMask(); }
    $("mask-dialog").showModal();
  } catch (error) { message(error.message, "error"); }
};
function pointerPosition(event) {
  const rect = maskCanvas.getBoundingClientRect();
  return [Math.max(0, Math.min(maskCanvas.width, (event.clientX - rect.left) / rect.width * maskCanvas.width)), Math.max(0, Math.min(maskCanvas.height, (event.clientY - rect.top) / rect.height * maskCanvas.height))];
}
function stroke(point) {
  selection.strokeStyle = $("mask-tool").value === "erase" ? "#000" : "#fff";
  selection.lineWidth = Number($("brush-size").value) * maskCanvas.width / maskCanvas.getBoundingClientRect().width;
  selection.lineCap = "round"; selection.beginPath(); selection.moveTo(...(previousPoint || point)); selection.lineTo(point[0] + .01, point[1] + .01); selection.stroke(); previousPoint = point; paintMask();
}
maskCanvas.onpointerdown = async event => {
  const point = pointerPosition(event), tool = $("mask-tool").value;
  if (tool.startsWith("sam-")) {
    if (!samReady) { $("sam-status").textContent = "‘SlimSAM 로드’를 먼저 눌러주세요. 준비 전에는 브러시를 사용할 수 있습니다."; return; }
    if (samBusy) return;
    const activeSession = maskSession;
    samPoints.push([point[0] / maskCanvas.width * maskImage.naturalWidth, point[1] / maskCanvas.height * maskImage.naturalHeight]); samLabels.push(tool === "sam-positive" ? 1 : 0);
    if (!samLabels.includes(1)) { samPoints.pop(); samLabels.pop(); $("sam-status").textContent = "먼저 포함할 영역을 한 번 클릭해 주세요."; return; }
    samBusy = true; $("mask-clear").disabled = true; $("mask-apply").disabled = true; $("sam-status").textContent = "클릭한 영역을 분할하고 있습니다…"; paintMask();
    try {
      const result = await segmentImage(state.references[0].url, samPoints, samLabels);
      if (activeSession !== maskSession || !$("mask-dialog").open) return;
      const raw = document.createElement("canvas"); raw.width = result.width; raw.height = result.height;
      const data = new Uint8ClampedArray(result.data.length * 4);
      for (let i = 0; i < result.data.length; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = result.data[i] ? 255 : 0; data[i * 4 + 3] = 255; }
      raw.getContext("2d").putImageData(new ImageData(data, result.width, result.height), 0, 0);
      selection.drawImage(raw, 0, 0, selectionCanvas.width, selectionCanvas.height); paintMask();
      $("sam-status").textContent = "영역을 선택했습니다. 포함/제외할 점을 추가하거나 브러시로 수정할 수 있습니다.";
    } catch (error) { if (activeSession === maskSession) { samPoints.pop(); samLabels.pop(); $("sam-status").textContent = `분할 실패: ${error.message} 브러시로 계속할 수 있습니다.`; } }
    finally { samBusy = false; $("mask-clear").disabled = false; $("mask-apply").disabled = false; }
    return;
  }
  if (samBusy) return;
  drawing = true; previousPoint = null; maskCanvas.setPointerCapture(event.pointerId); stroke(point);
};
maskCanvas.onpointermove = event => { if (drawing) stroke(pointerPosition(event)); };
maskCanvas.onpointerup = () => { drawing = false; previousPoint = null; };
maskCanvas.onpointercancel = maskCanvas.onpointerup;
$("mask-clear").onclick = resetMaskCanvas;
$("mask-export").onclick = async () => download(await canvasBlob(selectionCanvas, "image/png"), "selection-mask.png");
$("mask-apply").onclick = async () => {
  const pixels = selection.getImageData(0, 0, selectionCanvas.width, selectionCanvas.height).data;
  let hasSelection = false; for (let i = 0; i < pixels.length; i += 4) if (pixels[i]) { hasSelection = true; break; }
  if (!hasSelection) clearAppliedMask();
  else { state.mask = await canvasBlob(selectionCanvas, "image/png"); $("composite").disabled = false; $("mask-open").textContent = "선택 영역 수정 ↗"; }
  $("mask-dialog").close();
};
$("load-sam").onclick = async () => {
  $("load-sam").disabled = true;
  try { await loadSegmentation(text => $("sam-status").textContent = text); samReady = true; $("mask-tool").value = "sam-positive"; $("load-sam").textContent = "SlimSAM 준비 완료"; }
  catch (error) { $("sam-status").textContent = "SlimSAM을 불러오지 못했습니다. 모델 다운로드, 인터넷 연결, public/models 경로를 확인해 주세요. 브러시는 계속 사용할 수 있습니다."; $("load-sam").disabled = false; }
};

if (location.protocol === "file:") message("HTML 파일을 직접 열면 모듈과 기록 기능이 제한됩니다. 안내된 로컬 웹 서버 주소로 접속해 주세요.", "error");
try { state.records = await listHistory(); renderHistory(); }
catch { state.persisted = false; message("이 브라우저에서는 기록을 저장할 수 없습니다. 결과를 생성한 뒤 파일로 내려받아 주세요.", "error"); }
window.addEventListener("pagehide", () => { state.connection = null; $("api-key").value = ""; clearInterval(pollTimer); });
