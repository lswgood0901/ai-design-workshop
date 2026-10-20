import { bestMaskIndex } from "./core.mjs";
let model, processor, RawImage;
const LOCAL_MODEL = "Xenova/slimsam-77-uniform";
// A pinned library runtime is loaded only when the participant requests SlimSAM.
// Model weights are read from the repository's public/models folder, not a remote hub.
export async function loadSegmentation(onProgress = () => {}) {
  if (model) return;
  onProgress("SlimSAM 실행 라이브러리를 불러오는 중…");
  const library = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1");
  library.env.allowRemoteModels = false;
  library.env.allowLocalModels = true;
  library.env.localModelPath = new URL("../public/models/", import.meta.url).href;
  library.env.backends.onnx.wasm.numThreads = 1;
  RawImage = library.RawImage;
  const progress_callback = progress => {
    if (progress.status === "progress") onProgress(`모델 로드 ${Math.round(progress.progress || 0)}%`);
  };
  [model, processor] = await Promise.all([
    library.SamModel.from_pretrained(LOCAL_MODEL, { dtype: "q8", device: "wasm", progress_callback }),
    library.AutoProcessor.from_pretrained(LOCAL_MODEL),
  ]);
  onProgress("SlimSAM 준비 완료 · 포함/제외할 점을 클릭하세요.");
}
export async function segmentImage(imageURL, points, labels) {
  if (!model) throw new Error("먼저 SlimSAM을 로드해 주세요.");
  if (!points.length || points.length !== labels.length) throw new Error("분할할 영역을 클릭해 주세요.");
  const image = await RawImage.read(imageURL);
  const inputs = await processor(image, { input_points: [points], input_labels: [labels] });
  const outputs = await model(inputs);
  const masks = await processor.post_process_masks(outputs.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
  const mask = masks[0];
  const index = bestMaskIndex(outputs.iou_scores.data);
  const width = image.width, height = image.height, count = width * height;
  if (mask.data.length < (index + 1) * count) throw new Error("분할 결과 크기를 확인할 수 없습니다.");
  const selected = mask.data.slice(index * count, (index + 1) * count);
  return { width, height, data: selected };
}
