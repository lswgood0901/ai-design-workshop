# Workshop agent instructions

This repository supports a Korean product-design workshop. Explain decisions in plain Korean and create runnable files in the participant's chosen folder.

## Workflow

1. Inspect the folder and preserve existing work.
2. Begin with **Stage 1: interface only** using `docs/interface-requirements.md` and `prompts/01-interface.md`.
3. Use HTML/CSS/JavaScript, IndexedDB and the simple local HTTP server. Keep the first 45 minutes focused on the interface, image input and history.
4. Label mock results as UI tests. Connect FLUX or a GPU API when the participant moves to Stage 2.
5. For local participants, follow `docs/local-setup.md` and the pinned download helper during the break. Use **FLUX.2-klein-4B distilled** and its complete Diffusers components.
6. For GPU-server participants, use `docs/api.md` and runtime connection settings.

## Implementation

- Required: generate/edit modes, text input, reference image preview, result preview, persistent history with images/prompt/seed/time, reuse as input, and downloads.
- Save image blobs in IndexedDB and surface storage errors clearly.
- Generation uses a descriptive prompt. Editing uses the original image plus a specific change instruction. English prompting is a workshop recommendation; help translate Korean briefs while preserving their design intent.
- Keep model requests to the documented fields. The GPU API is synchronous and returns a binary WebP.
- Allow one inference request at a time. After an uncertain network failure, show the error and let the participant decide when to retry.
- Show the server's global queue state as global status.
- Keep the real API key only in the active tab's memory. Public examples use `YOUR_WORKSHOP_KEY`; saved files, exports and logs contain only non-secret settings.
- Optional extension: use `docs/segmentation.md` for region selection and client-side compositing of surface color/material edits. The main editing workflow remains image + prompt.

## Environment and completion

Inspect OS, GPU, driver, available memory and disk before local setup. Explain system-level installation or restart steps and obtain the participant's confirmation before applying them. Start local inference with one 512×512 image and report the observed result. Offer GPU-server mode when the current laptop needs more setup.

Run the page and check upload, preview, history after refresh, image reuse, downloads and visible errors. For a live backend, test one generation and one edit. Distinguish tested behavior from environment-dependent guidance.

Use the participant's preferred visual style. The `web/` folder is a working reference implementation.
