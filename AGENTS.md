# Workshop agent instructions

This repository supports a Korean product-design workshop. Explain decisions in plain Korean and make runnable files in the participant's chosen folder.

## Stage boundaries

- Start with **Stage 1 (interface only)** unless the participant explicitly asks to connect a model.
- Read `docs/interface-requirements.md` and `prompts/01-interface.md`.
- Use HTML/CSS/JavaScript and a simple local HTTP server. Avoid adding a large application framework, a database server, login, cloud deployment, or paid API dependency for the first exercise.
- Before creating files, inspect the selected folder and preserve existing work. Do not silently replace the participant's project.
- Do not download the FLUX model during Stage 1. During the break, follow `docs/model-download.md` and the checked-in helper for the **distilled FLUX.2-klein-4B**. Avoid base/FLUX 3 or duplicate root weights.
- GPU-server participants do not need local FLUX, PyTorch or CUDA.
- Inspect OS, GPU, driver, disk and memory before recommending local execution. Do not install or change system drivers without participant approval; never initiate an automatic reboot.
- Do not claim that a 16 GB Mac can reliably run the full BF16 pipeline. Use the server fallback when local inference is unverified or too slow.

## Functional contract

- Text prompt, generate/edit modes, reference image upload/preview, result preview, history with image/prompt/seed/time, reuse as input, and image download are required.
- Persist history in IndexedDB, including image blobs. Handle storage failures visibly.
- Mock/demo mode must be clearly labeled. Never present an uploaded image or placeholder as a model-generated result.
- Automatic segmentation and a manual brush are separate from FLUX. Read `docs/segmentation.md`.
- Do not send unsupported `mask_image`, `strength` or `negative_prompt` fields to the workshop API.
- For Stage 2, follow `docs/api.md` exactly. The workshop service is **synchronous** and returns a binary WebP, not BFL's hosted asynchronous JSON job format.
- Limit the UI to one inference request at a time. Do not automatically repeat a failed generation request; it may already be running on the GPU.
- Global queue status is not a user's individual queue position or percentage. Do not display fabricated progress.
- Keys are entered at runtime. Do not save real keys in source, prompts, browser history storage, exported history, logs, screenshots, README or commits. Use `YOUR_WORKSHOP_KEY` in examples.

## Completion

Run the page locally and check image upload, resizing, history persistence after refresh, image reuse, download and visible errors. For a live backend, check one generation and one edit. Report what has actually been tested and any remaining environment limitation.

Keep the participant's visual preferences. The reference `web/` is a working fallback, not a required visual template.
