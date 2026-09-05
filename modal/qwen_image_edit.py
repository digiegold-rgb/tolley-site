"""
Named Modal recipe for /generate stills.

App:      tolley-qwen-image-edit
Function: qwen_image_edit

Diffusers `QwenImageEditPlusPipeline` / Qwen-Image-Edit-2511 BF16,
three identity reference images, kwargs (not a frozen GUI).

Deploy (Modal CLI authenticated as the workspace that already ran A100 BF16):

    modal deploy modal/qwen_image_edit.py

Create a Modal secret named `tolley-generate` with:
    HF_TOKEN                  — Hugging Face token for Qwen/Qwen-Image-Edit-2511
    BLOB_READ_WRITE_TOKEN     — optional; upload stills to Vercel Blob
    GENERATE_WEBHOOK_SECRET   — optional; HMAC/bearer for the Vercel webhook

Do NOT assume Spark paths such as
/home/jelly/growth-engine/shorts/persona-refs/identity/*.jpg
exist on Modal workers. Pass HTTPS identity_ref_urls.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import os
from typing import Any

import modal

APP_NAME = "tolley-qwen-image-edit"
FUNCTION_NAME = "qwen_image_edit"
MODEL_ID = "Qwen/Qwen-Image-Edit-2511"

app = modal.App(APP_NAME)

hf_cache = modal.Volume.from_name("tolley-qwen-hf-cache", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .run_commands("echo tolley-image-rev=torchvision-1")
    .pip_install(
        "torch",
        "torchvision",
        "diffusers>=0.35.0",
        "transformers",
        "accelerate",
        "safetensors",
        "pillow",
        "huggingface_hub",
        "requests",
        "sentencepiece",
        "protobuf",
    )
)


def _load_refs(urls: list[str]) -> list[Any]:
    import requests
    from PIL import Image

    images = []
    for url in urls:
        url = (url or "").strip()
        if not url:
            continue
        if url.startswith("/home/") or url.startswith("/Users/"):
            raise ValueError(
                "Spark filesystem paths are not valid on Modal. "
                "Pass HTTPS identity_ref_urls (Vercel Blob)."
            )
        r = requests.get(url, timeout=90)
        r.raise_for_status()
        images.append(Image.open(io.BytesIO(r.content)).convert("RGB"))
    if not images:
        raise ValueError("identity_ref_urls is required (front / left / right HTTPS URLs)")
    return images


def _put_blob(pathname: str, png_bytes: bytes) -> str | None:
    token = (os.environ.get("BLOB_READ_WRITE_TOKEN") or "").strip()
    if not token:
        return None
    import requests

    r = requests.put(
        f"https://blob.vercel-storage.com/{pathname}",
        data=png_bytes,
        headers={
            "Authorization": f"Bearer {token}",
            "x-api-version": "7",
            "x-content-type": "image/png",
            "x-add-random-suffix": "1",
        },
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()
    return data.get("url")


def _notify_webhook(webhook_url: str | None, payload: dict[str, Any]) -> None:
    if not webhook_url:
        return
    import requests

    body = json.dumps(payload)
    secret = (
        os.environ.get("GENERATE_WEBHOOK_SECRET")
        or os.environ.get("MODAL_WEBHOOK_SECRET")
        or ""
    ).strip()
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["X-Generate-Signature"] = hmac.new(
            secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256
        ).hexdigest()
        headers["Authorization"] = f"Bearer {secret}"
    try:
        requests.post(webhook_url, data=body, headers=headers, timeout=30)
    except Exception as exc:  # noqa: BLE001 — webhook is best-effort
        print(f"webhook failed: {exc}")


@app.function(
    name=FUNCTION_NAME,
    image=image,
    gpu="A100-80GB",
    timeout=20 * 60,
    memory=65536,
    volumes={"/root/.cache/huggingface": hf_cache},
    secrets=[modal.Secret.from_name("tolley-generate")],
)
def qwen_image_edit(
    prompt: str,
    negative_prompt: str = " ",
    seed: int = 0,
    num_inference_steps: int = 40,
    height: int = 1664,
    width: int = 928,
    true_cfg_scale: float = 4.0,
    guidance_scale: float = 1.0,
    max_sequence_length: int = 512,
    identity_ref_urls: list[str] | None = None,
    extra_image_urls: list[str] | None = None,
    sigmas: list[float] | None = None,
    num_images: int = 1,
    job_id: str | None = None,
    webhook_url: str | None = None,
) -> dict[str, Any]:
    """Headless kwargs in, stills out. Proven BF16 Qwen-Image-Edit-2511 recipe."""
    import torch
    from diffusers import QwenImageEditPlusPipeline

    urls = list(identity_ref_urls or [])
    extras: list[str] = []
    image_urls: list[str] = []
    result: dict[str, Any] = {
        "status": "failed",
        "output_urls": [],
        "output_png_b64": [],
        "error": None,
        "job_id": job_id,
    }
    try:
        for raw in extra_image_urls or []:
            url = (raw or "").strip()
            if not url:
                continue
            if not url.lower().startswith("https://"):
                raise ValueError("extra_image_urls must be HTTPS URLs (max 3)")
            extras.append(url)
        extras = extras[:3]
        image_urls = urls + extras
        refs = _load_refs(image_urls)
        pipe = QwenImageEditPlusPipeline.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.bfloat16,
        )
        pipe.to("cuda")
        pipe.set_progress_bar_config(disable=None)

        generator = torch.Generator("cuda").manual_seed(int(seed))
        inputs: dict[str, Any] = {
            "image": refs,
            "prompt": prompt,
            "negative_prompt": negative_prompt or " ",
            "num_inference_steps": int(num_inference_steps),
            "true_cfg_scale": float(true_cfg_scale),
            "guidance_scale": float(guidance_scale),
            "num_images_per_prompt": int(num_images),
            "generator": generator,
            "height": int(height),
            "width": int(width),
            "max_sequence_length": int(max_sequence_length),
        }
        if sigmas:
            inputs["sigmas"] = [float(s) for s in sigmas]
        try:
            with torch.inference_mode():
                output = pipe(**inputs)
        except TypeError:
            inputs.pop("height", None)
            inputs.pop("width", None)
            with torch.inference_mode():
                output = pipe(**inputs)

        output_urls: list[str] = []
        output_b64: list[str] = []
        for i, img in enumerate(output.images):
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            png = buf.getvalue()
            name = f"generate/{job_id or 'anon'}/{i}.png"
            uploaded = _put_blob(name, png)
            if uploaded:
                output_urls.append(uploaded)
            else:
                output_b64.append(base64.b64encode(png).decode("ascii"))

        result = {
            "status": "done",
            "output_urls": output_urls,
            "output_png_b64": output_b64,
            "error": None,
            "job_id": job_id,
            "kwargs": {
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "seed": seed,
                "num_inference_steps": num_inference_steps,
                "height": height,
                "width": width,
                "true_cfg_scale": true_cfg_scale,
                "guidance_scale": guidance_scale,
                "max_sequence_length": max_sequence_length,
                "identity_ref_urls": urls,
                "extra_image_urls": extras,
                "sigmas": list(sigmas) if sigmas else None,
                "num_images": num_images,
            },
        }
    except Exception as exc:  # noqa: BLE001 — persist the worker error
        result["error"] = str(exc)[:2000]
        result["status"] = "failed"

    _notify_webhook(webhook_url, result)
    return result


@app.local_entrypoint()
def main() -> None:
    print(
        f"Recipe ready: {APP_NAME}/{FUNCTION_NAME} → {MODEL_ID} BF16. "
        "Deploy with: modal deploy modal/qwen_image_edit.py"
    )
