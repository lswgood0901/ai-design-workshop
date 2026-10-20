#!/usr/bin/env python3
"""Single-user FLUX.2-klein-4B API for a participant's own computer."""
from __future__ import annotations

import argparse
import base64
import binascii
import io
import logging
import re
import secrets
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr, field_validator, model_validator
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.middleware.trustedhost import TrustedHostMiddleware

ROOT = Path(__file__).resolve().parents[1]
MAX_IMAGE = 10 * 1024 * 1024
MAX_BODY = 29 * 1024 * 1024
MAX_PIXELS = 16_777_216
MAX_OUTPUT = 1_048_576
IMAGE_URL = re.compile(r"data:(image/(?:png|jpeg|webp));base64,(.+)", re.DOTALL)
LOG = logging.getLogger("local_flux")


class ImageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prompt: StrictStr = Field(min_length=1, max_length=32768)
    input_image: StrictStr | None = None
    input_image_2: StrictStr | None = None
    input_image_3: StrictStr | None = None
    input_image_4: StrictStr | None = None
    image: StrictStr | list[StrictStr] | None = None
    width: StrictInt | None = None
    height: StrictInt | None = None
    seed: StrictInt | None = Field(default=None, ge=0, le=4_294_967_295)
    output_format: Literal["webp"] = "webp"
    num_inference_steps: StrictInt = Field(default=4, ge=1, le=12)
    guidance_scale: float = Field(default=1.0, ge=0, le=10, allow_inf_nan=False)
    max_sequence_length: StrictInt = Field(default=512, ge=1, le=512)
    num_images_per_prompt: StrictInt = Field(default=1, ge=1, le=1)

    @field_validator("prompt")
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError("Enter a design instruction")
        return value.strip()

    @field_validator("width", "height")
    @classmethod
    def dimension(cls, value):
        if value == 0:
            return None
        if value is not None and (not 64 <= value <= 4096 or value % 16):
            raise ValueError("Use dimensions from 64 to 4096, in multiples of 16")
        return value

    @model_validator(mode="after")
    def references(self):
        fields = [self.input_image, self.input_image_2, self.input_image_3, self.input_image_4]
        if self.image is not None and any(x is not None for x in fields):
            raise ValueError("Use image or input_image fields")
        refs = self.image_inputs()
        if len(refs) > 4 or any(not v for v in refs):
            raise ValueError("Use 1 to 4 nonempty reference images")
        if self.width and self.height and self.width * self.height > MAX_OUTPUT:
            raise ValueError("Use an output size of at most 1 megapixel")
        return self

    def image_inputs(self):
        if self.image is not None:
            return self.image if isinstance(self.image, list) else [self.image]
        return [v for v in [self.input_image, self.input_image_2, self.input_image_3, self.input_image_4] if v is not None]


class GenerateRequest(ImageRequest):
    @model_validator(mode="after")
    def text_only(self):
        if self.image_inputs():
            raise ValueError("Use /v1/edit with reference images")
        return self


class EditRequest(ImageRequest):
    @model_validator(mode="after")
    def with_image(self):
        if not self.image_inputs():
            raise ValueError("Add at least one reference image")
        return self


class BodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        declared = dict(scope.get("headers", [])).get(b"content-length", b"0")
        try:
            size = int(declared)
            if size < 0:
                raise ValueError
        except ValueError:
            return await JSONResponse({"detail": "Invalid body length"}, status_code=400)(scope, receive, send)
        if size > MAX_BODY:
            return await JSONResponse({"detail": "Request exceeds 29 MiB"}, status_code=413)(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                continue
            size += len(message.get("body", b""))
            if size > MAX_BODY:
                return await JSONResponse({"detail": "Request exceeds 29 MiB"}, status_code=413)(scope, receive, send)
            chunks.append(message)
            if not message.get("more_body", False):
                break
        index = 0

        async def replay():
            nonlocal index
            if index < len(chunks):
                result = chunks[index]
                index += 1
                return result
            return await receive()

        await self.app(scope, replay, send)


def decode_image(value):
    mime, encoded = None, value
    if value.startswith("data:"):
        match = IMAGE_URL.fullmatch(value)
        if not match:
            raise HTTPException(422, "Use a PNG, JPG or WebP data URL")
        mime, encoded = match.groups()
    if len(encoded) > 4 * ((MAX_IMAGE + 2) // 3):
        raise HTTPException(413, "Each image can be up to 10 MiB")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "Invalid base64 image") from None
    if len(raw) > MAX_IMAGE:
        raise HTTPException(413, "Each image can be up to 10 MiB")
    formats = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in formats or (mime and formats[image.format] != mime):
                raise HTTPException(422, "Image format and data URL must match")
            if min(image.size) < 16 or image.width * image.height > MAX_PIXELS:
                raise HTTPException(413, "Use an image between 16 pixels per side and 16 megapixels")
            image.verify()
        with Image.open(io.BytesIO(raw)) as image:
            return ImageOps.exif_transpose(image).convert("RGB"), len(raw)
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise HTTPException(422, "Use a valid PNG, JPG or WebP image") from None


def output_size(width, height, reference=None):
    if width is None and height is None:
        if reference is None:
            return 1024, 1024
        scale = min(1, (MAX_OUTPUT / (reference[0] * reference[1])) ** 0.5,
                    4096 / reference[0], 4096 / reference[1])
        width, height = [max(64, int(v * scale) // 16 * 16) for v in reference]
    elif width is None:
        width = max(64, round(height * (reference[0] / reference[1] if reference else 1) / 16) * 16)
    elif height is None:
        height = max(64, round(width * (reference[1] / reference[0] if reference else 1) / 16) * 16)
    if max(width, height) > 4096 or width * height > MAX_OUTPUT:
        raise HTTPException(422, "Use an output size of at most 1 megapixel")
    return width, height


class FluxEngine:
    def __init__(self, model_dir, device):
        import torch
        from diffusers import Flux2KleinPipeline

        if not (Path(model_dir) / "model_index.json").is_file():
            raise RuntimeError("Download and verify models/FLUX.2-klein-4B first")
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "mps"
        if device == "cuda":
            if not torch.cuda.is_available() or not torch.cuda.is_bf16_supported():
                raise RuntimeError("Use a CUDA GPU with BF16 support or connect to the GPU server")
        else:
            if not torch.backends.mps.is_available():
                raise RuntimeError("Check arm64 Python, macOS 14+ and MPS availability")
            try:
                x = torch.ones((2, 2), device="mps", dtype=torch.bfloat16)
                (x @ x).cpu()
                del x
                torch.mps.empty_cache()
            except RuntimeError as error:
                raise RuntimeError("Check macOS 14+ and a PyTorch version supporting BF16 on MPS") from error
        self.torch, self.device = torch, device
        self.pipe = Flux2KleinPipeline.from_pretrained(
            str(model_dir), torch_dtype=torch.bfloat16, local_files_only=True,
            low_cpu_mem_usage=True,
        )
        if device == "cuda":
            self.pipe.enable_model_cpu_offload()
        else:
            self.pipe.to("mps")
        LOG.info("FLUX ready on %s", device)

    def invoke(self, body, images, seed, width, height):
        args = dict(prompt=body.prompt, width=width, height=height,
                    num_inference_steps=body.num_inference_steps,
                    guidance_scale=body.guidance_scale,
                    max_sequence_length=body.max_sequence_length,
                    num_images_per_prompt=1,
                    generator=self.torch.Generator(device="cpu").manual_seed(seed))
        if images:
            args["image"] = images if len(images) > 1 else images[0]
        with self.torch.inference_mode():
            return self.pipe(**args).images[0]


def create_app(engine_factory):
    state = {"engine": None, "error": None, "loading": True, "busy": False}
    slot = threading.Lock()

    def load():
        try:
            state["engine"] = engine_factory()
        except Exception as error:
            state["error"] = str(error)
            LOG.exception("Local model setup failed")
        finally:
            state["loading"] = False

    @asynccontextmanager
    async def lifespan(app):
        threading.Thread(target=load, daemon=True, name="flux-loader").start()
        yield

    app = FastAPI(title="Local FLUX.2-klein-4B", version="1.0", lifespan=lifespan)
    app.add_middleware(BodyLimit)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "[::1]"])
    app.add_middleware(CORSMiddleware,
        allow_origin_regex=r"http://(127\.0\.0\.1|localhost|\[::1\])(:\d+)?",
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "ngrok-skip-browser-warning"],
        expose_headers=["X-Seed", "X-GPU-ID", "X-Request-ID", "X-Inference-Seconds", "Retry-After"])

    def auth(request: Request):
        if request.headers.get("authorization") != "Bearer local":
            raise HTTPException(401, "Enter local in the API key field")

    @app.get("/health")
    def health():
        return {"ready_workers": int(state["engine"] is not None),
                "loading": state["loading"], "error": state["error"]}

    @app.get("/v1/status", dependencies=[Depends(auth)])
    def status():
        ready = state["engine"] is not None
        name = "busy" if state["busy"] else "ready" if ready else "loading" if state["loading"] else "error"
        return {**health(), "queue_size": 0,
                "workers": [{"gpu_id": 0, "state": name}], "max_output_pixels": MAX_OUTPUT}

    @app.get("/v1/schema", dependencies=[Depends(auth)])
    def schema():
        return app.openapi()

    def run(body):
        if state["engine"] is None:
            raise HTTPException(503, "Check /health while the model loads")
        if not slot.acquire(blocking=False):
            raise HTTPException(429, "Local GPU is processing one image", headers={"Retry-After": "3"})
        state["busy"] = True
        images = []
        try:
            total = 0
            for value in body.image_inputs():
                image, count = decode_image(value)
                images.append(image)
                total += count
                if total > 20 * 1024 * 1024:
                    raise HTTPException(413, "Reference images can total up to 20 MiB")
            width, height = output_size(body.width, body.height, images[0].size if images else None)
            seed = body.seed if body.seed is not None else secrets.randbelow(2 ** 32)
            started = time.monotonic()
            result = state["engine"].invoke(body, images, seed, width, height)
            output = io.BytesIO()
            result.save(output, format="WEBP", quality=95)
            return Response(output.getvalue(), media_type="image/webp", headers={
                "Cache-Control": "no-store", "X-Seed": str(seed), "X-GPU-ID": "0",
                "X-Request-ID": uuid.uuid4().hex,
                "X-Inference-Seconds": f"{time.monotonic() - started:.3f}"})
        except HTTPException:
            raise
        except Exception:
            LOG.exception("Local inference failed")
            raise HTTPException(503, "Check the local terminal; try 512x512 or use the GPU server") from None
        finally:
            for image in images:
                image.close()
            state["busy"] = False
            slot.release()

    @app.post("/v1/generate", dependencies=[Depends(auth)])
    def generate(body: GenerateRequest):
        return run(body)

    @app.post("/v1/edit", dependencies=[Depends(auth)])
    def edit(body: EditRequest):
        return run(body)

    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, default=ROOT / "models/FLUX.2-klein-4B")
    parser.add_argument("--device", choices=["auto", "cuda", "mps"], default="auto")
    parser.add_argument("--port", type=int, default=8032)
    args = parser.parse_args()
    import uvicorn
    logging.basicConfig(level=logging.INFO)
    uvicorn.run(create_app(lambda: FluxEngine(args.model_dir.resolve(), args.device)),
                host="127.0.0.1", port=args.port, workers=1)


if __name__ == "__main__":
    main()
