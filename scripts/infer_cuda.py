"""One protected FLUX.2-klein-4B inference on an NVIDIA CUDA GPU.

The common local worker launches this module in its own process. The outer
supervisor monitors host memory; this module limits PyTorch CUDA allocations.
Windows hardware validation is still required for this NF4 backend.
"""
from __future__ import annotations

import gc
import json
import os
from pathlib import Path

GIB = 1024**3
MIN_FREE_VRAM = 6 * GIB
VRAM_RESERVE = GIB
MAX_CUDA_ALLOCATION = 6 * GIB


def _allocation_budget(free: int, total: int) -> int:
    # An advertised 8 GB GPU may report slightly less than 8 GiB to CUDA.
    if total < 7.5 * GIB or free < MIN_FREE_VRAM:
        raise RuntimeError(
            "CUDA 4비트 실행에는 전용 GPU 메모리 8GB 이상과 현재 여유 VRAM "
            f"6GiB 이상이 필요합니다. 현재 여유: {free / GIB:.2f}GiB. "
            "GPU를 사용하는 앱을 정리하거나 GPU 서버에 연결해 주세요."
        )
    return int(min(MAX_CUDA_ALLOCATION, total * 0.85, free - VRAM_RESERVE))


def _stage(name: str, **details) -> None:
    print(json.dumps({"stage": name, **details}, ensure_ascii=False), flush=True)


def run(job: dict, model_dir: Path, output: Path) -> None:
    """Save a generated or edited WebP; model reads are always local-only."""
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["TOKENIZERS_PARALLELISM"] = "false"

    import torch

    if not torch.cuda.is_available():
        raise RuntimeError("NVIDIA 드라이버와 CUDA용 PyTorch를 확인하거나 GPU 서버에 연결해 주세요.")
    torch.cuda.set_device(0)
    if torch.cuda.get_device_capability(0)[0] < 8 or not torch.cuda.is_bf16_supported():
        raise RuntimeError("이 CUDA 4비트 경로는 BF16을 지원하는 RTX 30 시리즈 이후 GPU를 사용합니다.")
    free, total = torch.cuda.mem_get_info(0)
    budget = _allocation_budget(free, total)
    # This caps the PyTorch allocator, not memory allocated by every CUDA library.
    torch.cuda.set_per_process_memory_fraction(budget / total, 0)
    torch.cuda.reset_peak_memory_stats(0)
    _stage("cuda_preflight", free_vram_gib=round(free / GIB, 3),
           allocator_limit_gib=round(budget / GIB, 3), reserve_gib=1)

    def check_vram(stage: str) -> None:
        free_now, _ = torch.cuda.mem_get_info(0)
        if free_now < VRAM_RESERVE:
            raise RuntimeError(f"GPU 여유 메모리가 1GiB 미만이어서 {stage} 단계에서 중단했습니다.")

    from diffusers import (
        AutoencoderKLFlux2,
        BitsAndBytesConfig as DiffusersBitsAndBytesConfig,
        FlowMatchEulerDiscreteScheduler,
        Flux2KleinPipeline,
        Flux2Transformer2DModel,
    )
    from PIL import Image, ImageOps
    from transformers import (
        BitsAndBytesConfig as TransformersBitsAndBytesConfig,
        Qwen2TokenizerFast,
        Qwen3ForCausalLM,
    )

    model_dir = model_dir.resolve()
    index_path = model_dir / "model_index.json"
    if not index_path.is_file():
        raise RuntimeError("FLUX.2-klein-4B의 전체 Diffusers 모델 폴더를 지정해 주세요.")
    index = json.loads(index_path.read_text(encoding="utf-8"))
    if index.get("_class_name") != "Flux2KleinPipeline" or index.get("is_distilled") is not True:
        raise RuntimeError("이 경로는 FLUX.2-klein-4B distilled 모델을 사용합니다.")
    width, height = int(job.get("width", 512)), int(job.get("height", 512))
    if any(value < 64 or value > 512 or value % 16 for value in (width, height)):
        raise ValueError("로컬 메모리 보호 모드에서는 각 변을 64–512, 16의 배수로 설정해 주세요.")
    max_sequence_length = int(job.get("max_sequence_length", 512))
    if not 1 <= max_sequence_length <= 512:
        raise ValueError("max_sequence_length는 1–512 범위로 설정해 주세요.")
    image_paths = job.get("images", [])
    if len(image_paths) > 4:
        raise ValueError("참조 이미지는 최대 4장까지 사용할 수 있습니다.")

    dtype = torch.bfloat16
    quant_options = dict(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=dtype,
    )
    pipe = encoder_pipe = text_encoder = transformer = vae = None
    images = []
    try:
        _stage("loading_text_encoder_nf4")
        tokenizer = Qwen2TokenizerFast.from_pretrained(
            str(model_dir / "tokenizer"), local_files_only=True,
        )
        text_encoder = Qwen3ForCausalLM.from_pretrained(
            str(model_dir / "text_encoder"), local_files_only=True,
            quantization_config=TransformersBitsAndBytesConfig(**quant_options),
            dtype=dtype, device_map={"": 0}, low_cpu_mem_usage=True,
        ).eval()
        encoder_pipe = Flux2KleinPipeline(
            scheduler=None, vae=None, text_encoder=text_encoder,
            tokenizer=tokenizer, transformer=None, is_distilled=True,
        )
        check_vram("텍스트 인코딩")
        _stage("encoding_prompt")
        with torch.inference_mode():
            prompt_embeds, _ = encoder_pipe.encode_prompt(
                prompt=job["prompt"], device=torch.device("cuda:0"),
                max_sequence_length=max_sequence_length,
            )
        # Only the small embedding tensor survives into the image stage.
        encoder_pipe = text_encoder = tokenizer = None
        gc.collect()
        torch.cuda.empty_cache()
        check_vram("이미지 모델 로딩")

        _stage("loading_transformer_nf4")
        transformer = Flux2Transformer2DModel.from_pretrained(
            str(model_dir / "transformer"), local_files_only=True,
            quantization_config=DiffusersBitsAndBytesConfig(**quant_options),
            torch_dtype=dtype, device_map={"": 0}, low_cpu_mem_usage=True,
        ).eval()
        vae = AutoencoderKLFlux2.from_pretrained(
            str(model_dir / "vae"), local_files_only=True,
            torch_dtype=dtype, low_cpu_mem_usage=True,
        ).to("cuda:0").eval()
        vae.enable_slicing()
        # The checkpoint's default tile threshold is 1024, so lower it for the
        # protected 512px profile using AutoencoderKLFlux2's paired thresholds.
        vae.tile_sample_min_size = 256
        vae.tile_latent_min_size = 256 // (2 ** (len(vae.config.block_out_channels) - 1))
        vae.enable_tiling()
        scheduler = FlowMatchEulerDiscreteScheduler.from_pretrained(
            str(model_dir / "scheduler"), local_files_only=True,
        )
        pipe = Flux2KleinPipeline(
            scheduler=scheduler, vae=vae, text_encoder=None, tokenizer=None,
            transformer=transformer, is_distilled=True,
        )
        for path in image_paths:
            with Image.open(path) as source:
                reference = ImageOps.exif_transpose(source).convert("RGB")
            reference.thumbnail((512, 512), Image.Resampling.LANCZOS)
            images.append(reference)

        def on_step(_pipe, step, _timestep, callback_kwargs):
            check_vram("이미지 생성")
            _stage("denoising", step=step + 1)
            return callback_kwargs

        check_vram("이미지 생성")
        _stage("editing" if images else "generating")
        with torch.inference_mode():
            result = pipe(
                prompt_embeds=prompt_embeds,
                image=images or None,
                width=width, height=height,
                num_inference_steps=int(job.get("num_inference_steps", 4)),
                guidance_scale=float(job.get("guidance_scale", 1.0)),
                max_sequence_length=max_sequence_length,
                num_images_per_prompt=1,
                generator=torch.Generator(device="cpu").manual_seed(int(job["seed"])),
                callback_on_step_end=on_step,
            ).images[0]
        output.parent.mkdir(parents=True, exist_ok=True)
        result.save(output, format="WEBP", quality=95)
        _stage("saved", peak_cuda_allocated_gib=round(torch.cuda.max_memory_allocated(0) / GIB, 3))
    except torch.cuda.OutOfMemoryError as error:
        raise RuntimeError(
            "GPU 메모리 보호 한도에 도달해 작업을 중단했습니다. GPU를 사용하는 앱을 정리하거나 "
            "GPU 서버에 연결해 주세요."
        ) from error
    finally:
        pipe = encoder_pipe = text_encoder = transformer = vae = None
        for reference in images:
            reference.close()
        gc.collect()
        torch.cuda.empty_cache()
