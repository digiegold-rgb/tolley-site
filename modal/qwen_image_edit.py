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
    GENERATE_WEBHOOK_SECRET   — optional; HMAC/bearer for the Vercel webhook
    BLOB_READ_WRITE_TOKEN     — optional; Bearer when fetching private identity refs
    GENERATE_BLOB_FALLBACK    — optional; "1" to upload stills to a *private* Blob store

Job *outputs* stay off the public Vercel Blob store. Default: return PNG bytes
on the function result; Vercel persists them to Spark (preferred) or a private
Blob fallback. The webhook is a completion signal — no public CDN URLs.

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
import re
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


def _blob_bearer() -> str:
    return (
        os.environ.get("GENERATE_BLOB_READ_WRITE_TOKEN")
        or os.environ.get("BLOB_READ_WRITE_TOKEN")
        or ""
    ).strip()


def _is_vercel_blob_url(url: str) -> bool:
    host = ""
    try:
        from urllib.parse import urlparse

        host = (urlparse(url).hostname or "").lower()
    except Exception:  # noqa: BLE001
        return False
    return host.endswith(".blob.vercel-storage.com") or host == "blob.vercel-storage.com"


def _load_refs(urls: list[str]) -> list[Any]:
    import requests
    from PIL import Image

    images = []
    token = _blob_bearer()
    for url in urls:
        url = (url or "").strip()
        if not url:
            continue
        if url.startswith("/home/") or url.startswith("/Users/"):
            raise ValueError(
                "Spark filesystem paths are not valid on Modal. "
                "Pass HTTPS identity_ref_urls (Vercel Blob)."
            )
        headers = {}
        if token and _is_vercel_blob_url(url):
            headers["Authorization"] = f"Bearer {token}"
        r = requests.get(url, headers=headers, timeout=90)
        r.raise_for_status()
        images.append(Image.open(io.BytesIO(r.content)).convert("RGB"))
    if not images:
        raise ValueError("identity_ref_urls is required (front / left / right HTTPS URLs)")
    return images


def _blob_fallback_enabled() -> bool:
    flag = (os.environ.get("GENERATE_BLOB_FALLBACK") or "").strip().lower()
    return flag in {"1", "true", "on", "yes"}


def _put_private_blob(pathname: str, png_bytes: bytes) -> str | None:
    """Private-store fallback only. Never the default path for job outputs."""
    if not _blob_fallback_enabled():
        return None
    token = _blob_bearer()
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
            "x-vercel-blob-access": "private",
        },
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()
    url = data.get("url") or ""
    if ".public.blob.vercel-storage.com" in url:
        raise RuntimeError(
            "Blob fallback returned a public URL. Point BLOB_READ_WRITE_TOKEN "
            "at a private store (vercel blob create-store … --access private) "
            "or unset GENERATE_BLOB_FALLBACK and use Spark persist."
        )
    pathname_out = data.get("pathname")
    if pathname_out:
        return f"blob:{pathname_out.lstrip('/')}"
    return url or None


def _webhook_payload(result: dict[str, Any]) -> dict[str, Any]:
    """Completion signal only — no PNG bytes, no public Blob CDN URLs."""
    return {
        "status": result.get("status"),
        "job_id": result.get("job_id"),
        "error": result.get("error"),
        "outputs_ready": result.get("status") == "done",
        "output_urls": [],
        "output_png_b64": [],
    }


_SECRET_KEY_RE = re.compile(r"token|secret|password|api_key|authorization|hf_", re.I)
_INTERNAL_KEY_RE = re.compile(
    r"^(image|generator|job_id|webhook_url|callback_on_step_end|denoise|strength|denoising_strength)$",
    re.I,
)


def _is_secret_like(key: str) -> bool:
    return bool(_SECRET_KEY_RE.search(key or ""))


def _is_blocked_override_key(key: str) -> bool:
    return _is_secret_like(key) or bool(_INTERNAL_KEY_RE.match(key or ""))


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
    attention_kwargs: dict[str, Any] | None = None,
    pipe_overrides: dict | None = None,
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
        if attention_kwargs:
            inputs["attention_kwargs"] = dict(attention_kwargs)
        applied_overrides: list[str] = []
        if pipe_overrides:
            for key, value in pipe_overrides.items():
                if _is_blocked_override_key(str(key)):
                    continue
                inputs[key] = value
                applied_overrides.append(str(key))
        try:
            with torch.inference_mode():
                output = pipe(**inputs)
        except TypeError:
            inputs.pop("height", None)
            inputs.pop("width", None)
            try:
                with torch.inference_mode():
                    output = pipe(**inputs)
            except TypeError as exc:
                if applied_overrides:
                    raise TypeError(
                        "QwenImageEditPlusPipeline rejected pipe_overrides. "
                        f"Offending keys: {applied_overrides}. {exc}"
                    ) from exc
                raise

        output_urls: list[str] = []
        output_b64: list[str] = []
        for i, img in enumerate(output.images):
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            png = buf.getvalue()
            name = f"generate/{job_id or 'anon'}/{i}.png"
            uploaded = _put_private_blob(name, png)
            if uploaded:
                output_urls.append(uploaded)
            else:
                output_b64.append(base64.b64encode(png).decode("ascii"))

        result = {
            "status": "done",
            "output_urls": output_urls,
            "output_png_b64": output_b64,
            "outputs_ready": True,
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
                "attention_kwargs": dict(attention_kwargs) if attention_kwargs else None,
                "pipe_overrides": {k: pipe_overrides[k] for k in applied_overrides} if applied_overrides else {},
                "num_images": num_images,
            },
        }
    except Exception as exc:  # noqa: BLE001 — persist the worker error
        result["error"] = str(exc)[:2000]
        result["status"] = "failed"

    _notify_webhook(webhook_url, _webhook_payload(result))
    return result


@app.local_entrypoint()
def main() -> None:
    print(
        f"Recipe ready: {APP_NAME}/{FUNCTION_NAME} → {MODEL_ID} BF16. "
        "Deploy with: modal deploy modal/qwen_image_edit.py"
    )
