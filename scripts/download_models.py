#!/usr/bin/env python3
"""Pinned workshop model download; default only prints a plan (no weight download).

Use --download to fetch, --verify to validate existing/USB-copied files offline.
No torch import, driver installation, token, or remote Python execution is needed.
"""
from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
# Generated from the public Hugging Face API at an immutable commit, 2026-10-20.
MODELS = {'flux': {'repo_id': 'black-forest-labs/FLUX.2-klein-4B',
          'revision': 'e7b7dc27f91deacad38e78976d1f2b499d76a294',
          'directory': 'models/FLUX.2-klein-4B',
          'allow_patterns': ['LICENSE.md',
                             'README.md',
                             'model_index.json',
                             'scheduler/*',
                             'text_encoder/*',
                             'tokenizer/*',
                             'transformer/*',
                             'vae/*'],
          'files': [{'path': 'LICENSE.md',
                     'bytes': 9584,
                     'git_sha1': '0afa7632c1a195ea6627a3c53e6ebf18d1be3aa5'},
                    {'path': 'README.md',
                     'bytes': 9991,
                     'git_sha1': '7b3cca65056e19a6ef27bdd0be671a030f067942'},
                    {'path': 'model_index.json',
                     'bytes': 446,
                     'git_sha1': '554a39bf1019138dd0b28809b745df8ef33657c8'},
                    {'path': 'scheduler/scheduler_config.json',
                     'bytes': 486,
                     'git_sha1': '7e53605e2643440b310fa554f087641893883c5f'},
                    {'path': 'text_encoder/config.json',
                     'bytes': 1536,
                     'git_sha1': '86f951d170cfd1fdc1c8a57a041e05c27b7b789b'},
                    {'path': 'text_encoder/generation_config.json',
                     'bytes': 214,
                     'git_sha1': 'f5af93d0c7764fa38e3b1cd3aaba1b6307246d3b'},
                    {'path': 'text_encoder/model-00001-of-00002.safetensors',
                     'bytes': 4967215360,
                     'sha256': '8c0506e7f4936fa7e26183a4fd8da4e2bdbc5990ba64ae441f965d51228f36ea'},
                    {'path': 'text_encoder/model-00002-of-00002.safetensors',
                     'bytes': 3077766632,
                     'sha256': '82f2bd839378541b0557bfabaf37c7d3d637071fdcb73302dedd7cf61162ce07'},
                    {'path': 'text_encoder/model.safetensors.index.json',
                     'bytes': 32855,
                     'git_sha1': 'b65d8063815c8679d85bb919337b36fae8de75cf'},
                    {'path': 'tokenizer/added_tokens.json',
                     'bytes': 707,
                     'git_sha1': 'b54f9135e44c1e81047e8d05cb027af8bc039eed'},
                    {'path': 'tokenizer/chat_template.jinja',
                     'bytes': 4168,
                     'git_sha1': '01be9b307daa2d425f7c168c9fb145a286e0afb4'},
                    {'path': 'tokenizer/merges.txt',
                     'bytes': 1671853,
                     'git_sha1': '31349551d90c7606f325fe0f11bbb8bd5fa0d7c7'},
                    {'path': 'tokenizer/special_tokens_map.json',
                     'bytes': 613,
                     'git_sha1': 'ac23c0aaa2434523c494330aeb79c58395378103'},
                    {'path': 'tokenizer/tokenizer.json',
                     'bytes': 11422654,
                     'sha256': 'aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4'},
                    {'path': 'tokenizer/tokenizer_config.json',
                     'bytes': 5404,
                     'git_sha1': 'ddaf69808214a44fdd26d3785b66c1367c78277a'},
                    {'path': 'tokenizer/vocab.json',
                     'bytes': 2776833,
                     'git_sha1': '4783fe10ac3adce15ac8f358ef5462739852c569'},
                    {'path': 'transformer/config.json',
                     'bytes': 541,
                     'git_sha1': 'f21592ae2bc9f43052e78785bde7414f219ae369'},
                    {'path': 'transformer/diffusion_pytorch_model.safetensors',
                     'bytes': 7751109744,
                     'sha256': '9f29f9edcfdae452a653ffb51a534ca4decd389952c225724ff3b94042612a6e'},
                    {'path': 'vae/config.json',
                     'bytes': 821,
                     'git_sha1': 'c3f38eb4c188a96a462519159356bd0fcc28cd14'},
                    {'path': 'vae/diffusion_pytorch_model.safetensors',
                     'bytes': 168120878,
                     'sha256': 'ca70d2202afe6415bdbcb8793ba8cd99fd159cfe6192381504d6c4d3036e0f04'}]},
 'segmentation': {'repo_id': 'Xenova/slimsam-77-uniform',
                  'revision': '5850ab45f587c112167512ffef949107115e26a0',
                  'directory': 'public/models/Xenova/slimsam-77-uniform',
                  'allow_patterns': ['README.md',
                                     'config.json',
                                     'preprocessor_config.json',
                                     'onnx/vision_encoder_quantized.onnx',
                                     'onnx/prompt_encoder_mask_decoder_quantized.onnx'],
                  'files': [{'path': 'README.md',
                             'bytes': 2987,
                             'git_sha1': 'dff14a772474251dbaa3920e4bebb2d84e5d3ad5'},
                            {'path': 'config.json',
                             'bytes': 379,
                             'git_sha1': 'b69eda4ef734658139fd9d27f35a1a16130ef8cf'},
                            {'path': 'onnx/prompt_encoder_mask_decoder_quantized.onnx',
                             'bytes': 4903810,
                             'sha256': 'cb90b279f549d2cab7fd6e20c38522438c65d84bdcca3d2a764cff7d857fdce2'},
                            {'path': 'onnx/vision_encoder_quantized.onnx',
                             'bytes': 8882165,
                             'sha256': 'cce23c7b2e5d4f330932738fb67ba518e04b0d99ccdd1cccd22a7da4e01f2971'},
                            {'path': 'preprocessor_config.json',
                             'bytes': 466,
                             'git_sha1': '732fbaf0c512b97d8d9161f51bc157bfb2873d12'}]}}


def inside(root: Path, filename: str) -> Path:
    relative = PurePosixPath(filename)
    if relative.is_absolute() or ".." in relative.parts or "\\" in filename:
        raise ValueError(f"Unsafe model path: {filename}")
    path = root.joinpath(*relative.parts)
    # Reject escaped symlinks, including a destination supplied by --output-dir.
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Model path leaves destination: {filename}")
    return path


def digest(path: Path, algorithm: str, git_blob: bool = False) -> str:
    h = hashlib.new(algorithm)
    with path.open("rb") as stream:
        if git_blob:
            h.update(f"blob {path.stat().st_size}\0".encode())
        while chunk := stream.read(8 * 1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def verify_files(folder: Path, spec: dict) -> list[str]:
    errors = []
    for item in spec["files"]:
        path = inside(folder, item["path"])
        if not path.is_file():
            errors.append(f"Missing: {item['path']}")
        elif path.stat().st_size != item["bytes"]:
            errors.append(f"Wrong size: {item['path']}")
        elif "sha256" in item:
            if digest(path, "sha256") != item["sha256"]:
                errors.append(f"SHA-256 mismatch: {item['path']}")
        elif digest(path, "sha1", git_blob=True) != item["git_sha1"]:
            errors.append(f"Git blob checksum mismatch: {item['path']}")
    return errors


def validate_remote(spec: dict) -> None:
    """Check only public metadata; never sends a Hugging Face access token."""
    url = (f"https://huggingface.co/api/models/{spec['repo_id']}/"
           f"revision/{spec['revision']}?blobs=true")
    request = urllib.request.Request(url, headers={"User-Agent": "ai-design-workshop/1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        info = json.load(response)
    if info["sha"] != spec["revision"] or info.get("gated"):
        raise RuntimeError("Unexpected repository revision or access gate; stop and ask the instructor.")
    remote = {item["rfilename"]: item for item in info["siblings"]}
    for item in spec["files"]:
        current = remote.get(item["path"], {})
        if current.get("size") != item["bytes"]:
            raise RuntimeError(f"Metadata size changed: {item['path']}")
        if "sha256" in item:
            if current.get("lfs", {}).get("sha256") != item["sha256"]:
                raise RuntimeError(f"Metadata checksum changed: {item['path']}")
        elif current.get("blobId") != item["git_sha1"]:
            raise RuntimeError(f"Metadata checksum changed: {item['path']}")
        if not any(fnmatch.fnmatchcase(item["path"], p) for p in spec["allow_patterns"]):
            raise RuntimeError(f"Unexpected file outside allowlist: {item['path']}")


def write_receipt(folder: Path, spec: dict) -> None:
    receipt = {"repo_id": spec["repo_id"], "revision": spec["revision"],
               "total_bytes": sum(x["bytes"] for x in spec["files"]),
               "checksum_verified": True, "files": spec["files"]}
    target = folder / ".workshop-model-manifest.json"
    temp = folder / ".workshop-model-manifest.json.tmp"
    temp.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, target)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", choices=MODELS, default="flux")
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--download", action="store_true", help="Download the listed files, then check every checksum")
    action.add_argument("--verify", action="store_true", help="Verify local files offline; useful for USB copies")
    parser.add_argument("--offline", action="store_true", help="Print the bundled pinned manifest without a network metadata check")
    parser.add_argument("--output-dir", type=Path, help="Override the model directory; the UI expects the default segmentation path")
    parser.add_argument("--workers", type=int, choices=range(1, 9), default=2, metavar="1..8")
    parser.add_argument("--force-download", action="store_true", help="With --download, replace the selected files after a failed checksum")
    args = parser.parse_args(argv)
    if args.download and args.offline:
        parser.error("--download needs internet; --offline is only for the plan/verification")
    if args.force_download and not args.download:
        parser.error("--force-download requires --download")
    spec = MODELS[args.model]
    folder = (args.output_dir or ROOT / spec["directory"]).expanduser().resolve()
    total = sum(x["bytes"] for x in spec["files"])
    print(f"Model: {spec['repo_id']}")
    print(f"Revision: {spec['revision']}")
    print(f"Selected: {len(spec['files'])} files / {total:,} bytes / {total / 10**9:.3f} GB / {total / 2**30:.3f} GiB")
    print(f"Destination: {folder}")
    if not args.offline and not args.verify:
        validate_remote(spec)
        print("Pinned public metadata: verified")
    if not args.download and not args.verify:
        for item in spec["files"]:
            print(f"  {item['bytes']:>14,}  {item['path']}")
        print("Plan only. Use --download to fetch, or --verify to check an existing copy.")
        return 0
    if args.download:
        try:
            from huggingface_hub import snapshot_download
        except ImportError:
            raise RuntimeError("Install the small download helper first: python -m pip install -r requirements-download.txt") from None
        folder.mkdir(parents=True, exist_ok=True)
        missing = sum(item["bytes"] for item in spec["files"]
                      if args.force_download or not inside(folder, item["path"]).is_file()
                      or inside(folder, item["path"]).stat().st_size != item["bytes"])
        required = missing + max(100 * 2**20, missing // 10)
        if shutil.disk_usage(folder).free < required:
            raise RuntimeError(f"Not enough free space. Need about {required / 10**9:.2f} GB free for this download.")
        # The exact allowlist prevents downloading the duplicate single-file FLUX checkpoint.
        # HF Hub resumes interrupted downloads using local_dir/.cache/huggingface.
        snapshot_download(repo_id=spec["repo_id"], revision=spec["revision"],
                          allow_patterns=[item["path"] for item in spec["files"]],
                          local_dir=str(folder), token=False, max_workers=args.workers,
                          force_download=args.force_download)
    print("Verifying file sizes and content checksums (large model may take a few minutes)...")
    failures = verify_files(folder, spec)
    if failures:
        raise RuntimeError("Verification failed:\n" + "\n".join(failures) +
                           "\nRetry --download to resume; for a checksum mismatch, use --download --force-download.")
    write_receipt(folder, spec)
    print("Complete: every required file matched its pinned size and checksum.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nStopped. Run the same download command to resume.", file=sys.stderr)
        sys.exit(130)
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
