"""Cloud-only Store Display worker: fal.ai or deployed Modal Wan, CPU FFmpeg.

No local GPU client, Spark endpoint, provider fallback, automatic paid retry,
or public publishing. Job artifacts and provider receipts live on a Modal Volume.
"""
import base64
import hashlib
import ipaddress
import json
import os
import re
import socket
import subprocess
import textwrap
import time
from pathlib import Path
from urllib.parse import urlparse

import modal

APP = "tolley-shop-videos"
VERSION = "store-display-v1"
DATA = Path("/data")
app = modal.App(APP)
image = modal.Image.debian_slim(python_version="3.12").apt_install("ffmpeg", "fonts-dejavu-core").pip_install("requests==2.32.5", "Pillow==12.1.1").env({"SHOP_VIDEO_WORKER_BUILD": "20261007b"})
volume = modal.Volume.from_name("tolley-shop-videos", create_if_missing=True)
claims = modal.Dict.from_name("tolley-shop-video-claims", create_if_missing=True)
secret = modal.Secret.from_name("tolley-shop-video-secrets", required_keys=["FAL_KEY"])
# Immutable existing ComfyUI/Wan image; reuse installed dependencies and the
# shared model volume without changing the older lady/vater deployment.
wan_image = modal.Image.from_id("im-dVbYMOnzQkyfX4hr67Oedc").add_local_file(Path(__file__).with_name("shop_video_wan.json"), "/opt/shop_video_wan.json")
models = modal.Volume.from_name("vater-wan22-models")


class HeldJob(Exception):
    pass


def job_dir(job_id):
    if not isinstance(job_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{10,80}", job_id):
        raise ValueError("Invalid job ID")
    return DATA / job_id


def write_state(directory, state):
    tmp = directory / "state.tmp"
    tmp.write_text(json.dumps(state))
    tmp.replace(directory / "state.json")
    volume.commit()


def allowed_url(url, kind):
    u = urlparse(url)
    h = u.hostname or ""
    if u.scheme != "https" or u.username or u.password or u.port:
        raise ValueError("Unsupported media URL")
    if kind == "queue":
        permitted = h == "queue.fal.run"
    elif kind == "artifact":
        permitted = h == "fal.media" or h.endswith(".fal.media") or h == "storage.googleapis.com"
    else:
        permitted = h.endswith(".public.blob.vercel-storage.com") or h.endswith(".tiktokcdn-us.com") or h.endswith(".tiktokcdn.com") or h.endswith(".ibyteimg.com") or h == "www.tolley.io"
    if not permitted:
        raise ValueError("Unsupported media host")
    # Downloads cannot address the operator's LAN, metadata services or tailnet.
    for entry in socket.getaddrinfo(h, 443, type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(entry[4][0]).is_global:
            raise ValueError("Media host is not public")
    return url


def download(url, out, kind="input", maximum=60 * 1024 * 1024):
    import requests
    for _ in range(4):
        r = requests.get(allowed_url(url, kind), timeout=(15, 120), stream=True, allow_redirects=False)
        if r.is_redirect:
            # Validate each redirect; credentials are never forwarded.
            from urllib.parse import urljoin
            url = urljoin(url, r.headers["Location"])
            r.close()
            continue
        r.raise_for_status()
        if int(r.headers.get("Content-Length", "0")) > maximum:
            raise ValueError("Media exceeds the size limit")
        size = 0
        with open(out, "wb") as dest:
            for chunk in r.iter_content(65536):
                size += len(chunk)
                if size > maximum:
                    raise ValueError("Media exceeds the size limit")
                dest.write(chunk)
        if not size:
            raise ValueError("Empty media")
        return
    raise ValueError("Too many media redirects")


def inline_image(path):
    from PIL import Image
    with Image.open(path) as im:
        im.verify()
    with Image.open(path) as im:
        im.convert("RGB").save(path.with_suffix(".jpg"), quality=93)
    return "data:image/jpeg;base64," + base64.b64encode(path.with_suffix(".jpg").read_bytes()).decode()


def paid_fal(directory, state, stage, model, body, cents, allowance):
    import requests
    stages = state.setdefault("stages", {})
    old = stages.get(stage)
    if old and not old.get("status_url"):
        raise HeldJob("Previous provider submission is ambiguous; reconcile it before another paid request")
    if not old:
        reserved = sum(s["estimatedCents"] for s in stages.values())
        if reserved + cents > allowance:
            raise ValueError("Generation allowance exhausted")
        stages[stage] = {"model": model, "estimatedCents": cents, "status": "submitting"}
        write_state(directory, state)  # durable intent BEFORE the single paid POST
        headers = {"Authorization": "Key " + os.environ["FAL_KEY"]}
        try:
            r = requests.post("https://queue.fal.run/" + model, headers=headers, json=body, timeout=60)
        except requests.RequestException:
            raise HeldJob("Provider submission could not be confirmed; no automatic retry") from None
        if r.status_code >= 500:
            raise HeldJob("Provider submission could not be confirmed; no automatic retry")
        if r.status_code != 200:
            # Owner-only diagnostic state; never return provider bodies to HQ.
            stages[stage]["httpStatus"] = r.status_code
            stages[stage]["rejectionDiagnostic"] = r.text.replace(os.environ["FAL_KEY"], "[redacted]")[:500]
            write_state(directory, state)
            if r.status_code in (402, 403) and any(word in r.text.lower() for word in ("balance", "credit", "billing")):
                raise ValueError("fal generation is blocked by account billing or credits; check the fal dashboard")
            raise ValueError(f"Provider rejected {stage} (HTTP {r.status_code})")
        receipt = r.json()
        for field in ("status_url", "response_url"):
            allowed_url(receipt[field], "queue")
        stages[stage].update({k: receipt[k] for k in ("request_id", "status_url", "response_url")})
        stages[stage]["status"] = "queued"
        write_state(directory, state)
        old = stages[stage]
    headers = {"Authorization": "Key " + os.environ["FAL_KEY"]}
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        try:
            r = requests.get(allowed_url(old["status_url"], "queue"), headers=headers, timeout=30, allow_redirects=False)
            if r.status_code in (408, 429, 500, 502, 503, 504):
                time.sleep(5)
                continue
            r.raise_for_status()
            status = r.json().get("status")
            if status == "COMPLETED":
                result = requests.get(allowed_url(old["response_url"], "queue"), headers=headers, timeout=60, allow_redirects=False)
                if result.status_code in (408, 429, 500, 502, 503, 504):
                    time.sleep(5)
                    continue
                result.raise_for_status()
                old["status"] = "complete"
                write_state(directory, state)
                return result.json()
            if status not in ("IN_QUEUE", "IN_PROGRESS"):
                raise ValueError(f"Provider {stage} did not complete")
        except (requests.Timeout, requests.ConnectionError):
            pass  # reads may retry; a paid submission never does
        time.sleep(3)
    raise HeldJob("Provider is still running; reconcile the saved request ID in fal before another generation")


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", str(path)], capture_output=True, check=True, timeout=30)
    info = json.loads(r.stdout)
    stream = next(s for s in info["streams"] if s["codec_type"] == "video")
    return {"duration": float(info["format"]["duration"]), "width": stream["width"], "height": stream["height"]}


def assemble(ai_path, real_path, output_path, overlay, format_name):
    """240 frames at 30fps. Pad rather than crop the linked product."""
    if probe(ai_path)["duration"] < 3.99:
        raise ValueError("AI clip is shorter than four seconds")
    if format_name == "hybrid" and (not real_path or probe(real_path)["duration"] < 3.99):
        raise ValueError("Hybrid videos need at least four seconds of real product footage")
    if format_name not in ("hybrid", "boomerang"):
        raise ValueError("Unsupported video format")
    overlay_file = output_path.parent / "overlay.txt"
    overlay_file.write_text("\n".join(textwrap.wrap(overlay, width=28, break_long_words=True)))
    normalize = "fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x151719,setsar=1,trim=end_frame=120,setpts=PTS-STARTPTS"
    args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-protocol_whitelist", "file,pipe", "-i", str(ai_path)]
    if format_name == "hybrid":
        args += ["-protocol_whitelist", "file,pipe", "-i", str(real_path)]
        graph = f"[0:v]{normalize}[ai];[1:v]{normalize}[real];[real][ai]concat=n=2:v=1:a=0[loop]"
    else:
        graph = f"[0:v]{normalize},split=2[forward][back];[back]reverse[reverse];[forward][reverse]concat=n=2:v=1:a=0[loop]"
    font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    # User text is read from a file with expression expansion disabled.
    graph += f";[loop]drawtext=fontfile={font}:textfile={overlay_file}:expansion=none:fontsize=56:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=22:line_spacing=12:x=(w-tw)/2:y=210,drawtext=fontfile={font}:text='AI-assisted':expansion=none:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=8:x=w-tw-85:y=1450[out]"
    args += ["-filter_complex", graph, "-map", "[out]", "-an", "-frames:v", "240", "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-maxrate", "3M", "-bufsize", "3M", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-threads", "2", str(output_path)]
    subprocess.run(args, capture_output=True, check=True, timeout=240)
    meta = probe(output_path)
    if abs(meta["duration"] - 8) > 0.1 or (meta["width"], meta["height"]) != (1080, 1920) or output_path.stat().st_size > 4*1024*1024:
        raise ValueError("Export format verification failed")
    return meta


@app.function(image=image, secrets=[secret], timeout=30)
def health():
    import requests
    authorized = False
    if os.environ.get("FAL_KEY"):
        try:
            authorized = requests.get("https://api.fal.ai/v1/models", params={"limit": 1}, headers={"Authorization": "Key " + os.environ["FAL_KEY"]}, timeout=8).status_code == 200
        except requests.RequestException:
            pass
    return {"ready": True, "fal": authorized, "version": VERSION}


@app.function(image=wan_image, volumes={"/models": models, "/data": volume}, gpu="L40S", cpu=4, memory=65536, timeout=840, retries=0, max_containers=1, scaledown_window=5)
def motion(job_id: str, image_bytes: bytes, prompt: str):
    """Dedicated cloud Wan with sufficient host RAM and a supervised model process."""
    import random
    import shutil
    import urllib.request
    volume.reload()
    directory = job_dir(job_id)
    directory.mkdir(parents=True, exist_ok=True)
    for sub in ("diffusion_models", "vae", "text_encoders", "loras", "clip_vision"):
        src, dst = Path("/models") / sub, Path("/opt/ComfyUI/models") / sub
        if src.exists() and not dst.is_symlink():
            if dst.is_dir():
                shutil.rmtree(dst)
            elif dst.exists():
                dst.unlink()
            dst.symlink_to(src)
    name = f"shop-{job_id}.png"
    (Path("/opt/ComfyUI/input") / name).write_bytes(image_bytes)
    text = Path("/opt/shop_video_wan.json").read_text()
    values = {"IMAGE_NAME": name, "POSITIVE_PROMPT": prompt, "NEGATIVE_PROMPT": "distorted product, warped labels, changing colors, extra accessories, missing product parts, hands, people, animation, cartoon, morphing, flicker, camera shake", "FILENAME_PREFIX": f"shop-{job_id}"}
    for key, value in values.items():
        text = text.replace('"{{' + key + '}}"', json.dumps(value))
    numbers = {"WIDTH": 480, "HEIGHT": 848, "NUM_FRAMES": 65, "TOTAL_STEPS": 20, "HANDOFF_STEP": 10, "CFG": 3.5, "SHIFT": 5, "SEED": random.randrange(1, 2**31), "FRAME_RATE": 16, "LORA_STRENGTH": 0, "START_LATENT_STRENGTH": 1, "END_LATENT_STRENGTH": 0}
    for key, value in numbers.items():
        text = text.replace("{{" + key + "}}", str(value))
    workflow = json.loads(text)
    workflow.pop("_comment", None)
    # Product realism: use base I2V weights without the older anime style LoRA.
    workflow.pop("22", None)
    workflow.pop("23", None)
    for node in workflow.values():
        node.pop("_comment", None)
    for key in ("20", "21"):
        workflow[key]["inputs"].pop("lora", None)
        workflow[key]["inputs"]["attention_mode"] = "sageattn"
    log = (directory / "comfy.log").open("wb")
    proc = subprocess.Popen(["python3", "main.py", "--listen", "127.0.0.1", "--port", "8188", "--disable-auto-launch"], cwd="/opt/ComfyUI", stdout=log, stderr=subprocess.STDOUT)
    def read(endpoint):
        with urllib.request.urlopen("http://127.0.0.1:8188/" + endpoint, timeout=10) as response:
            return json.loads(response.read())
    try:
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                raise RuntimeError("Modal model process exited during startup")
            try:
                read("system_stats")
                break
            except Exception:
                time.sleep(2)
        else:
            raise RuntimeError("Modal model process startup timed out")
        body = json.dumps({"prompt": workflow, "client_id": job_id}).encode()
        request = urllib.request.Request("http://127.0.0.1:8188/prompt", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=30) as response:
            prompt_id = json.loads(response.read())["prompt_id"]
        deadline = time.monotonic() + 690
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                raise RuntimeError("Modal model process exited during generation; inspect its saved process log")
            item = read("history/" + prompt_id).get(prompt_id)
            if item:
                status = item.get("status", {})
                if status.get("status_str") == "error":
                    raise RuntimeError("Modal product motion workflow failed; inspect its saved process log")
                if status.get("completed"):
                    for node in item.get("outputs", {}).values():
                        for entry in node.get("videos", []) + node.get("gifs", []):
                            path = (Path("/opt/ComfyUI/output") / entry.get("subfolder", "") / entry["filename"]).resolve()
                            if path.is_relative_to("/opt/ComfyUI/output") and path.suffix == ".mp4":
                                return path.read_bytes()
                    raise RuntimeError("Modal product motion returned no MP4")
            time.sleep(3)
        raise RuntimeError("Modal product motion exceeded its execution window")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
        log.close()
        volume.commit()


def render_job(payload: dict):
    directory = job_dir(payload["job_id"])
    volume.reload()
    result_file = directory / "result.json"
    if result_file.is_file():
        return json.loads(result_file.read_text())
    if not claims.put(payload["job_id"], {"claimed": time.time()}, skip_if_exists=True):
        raise HeldJob("This job already has a worker; do not submit it again")
    directory.mkdir(parents=True, exist_ok=True)
    state = {"job_id": payload["job_id"], "stages": {}, "recipe": VERSION}
    try:
        if payload.get("recipe_version") != VERSION or payload.get("provider") not in ("fal", "modal") or payload.get("format") not in ("hybrid", "boomerang"):
            raise ValueError("Only the cloud Store Display recipe is supported")
        p = payload["product"]
        if not p.get("rightsConfirmed") or not p.get("authenticityConfirmed"):
            raise ValueError("Product rights and authenticity must be confirmed")
        if payload["format"] == "hybrid" and not p.get("realFootageConfirmed"):
            raise ValueError("Confirm real product demonstration footage first")
        scene = payload["scene"]
        if scene not in ("original", "countertop", "shelf", "studio"):
            raise ValueError("Unsupported display scene")
        allowance = int(payload["allowance_cents"])
        minimum = (5 if payload["provider"] == "fal" else 150) + (0 if scene == "original" else 3)
        if allowance < minimum or allowance > 2000:
            raise ValueError("Invalid generation allowance")
        overlay = payload["overlay"]
        if not isinstance(overlay, str) or not 1 <= len(overlay.strip()) <= 120:
            raise ValueError("Use an overlay of 1–120 characters")
        source = directory / "source.png"
        download(p["imageUrl"], source, maximum=15*1024*1024)
        image_url = inline_image(source)
        real = None
        if payload["format"] == "hybrid":
            real = directory / "real.mp4"
            download(p["realVideoUrl"], real)
            if probe(real)["duration"] < 3.99:
                raise ValueError("Hybrid videos need at least four seconds of real product footage")
        if scene != "original":
            setting = {"countertop": "a clean neutral retail display countertop", "shelf": "a single clean retail display shelf", "studio": "a neutral professional product photography studio"}[scene]
            edited = paid_fal(directory, state, "scene", "fal-ai/qwen-image-edit-2511", {
                "prompt": f"Place the EXACT reference product on {setting}. Preserve its shape, proportions, color, branding, packaging, texture and printed text. Show only the exact single product and variant in the reference. Do not add accessories, features, discounts, claims, signage, people, extra products or text. Keep the entire product visible with space above for an overlay. Vertical product photograph.",
                "image_urls": [image_url], "image_size": {"width": 720, "height": 1280}, "num_images": 1, "enable_safety_checker": True, "output_format": "png",
            }, 3, allowance)
            source = directory / "scene.png"
            download(edited["images"][0]["url"], source, "artifact", 15*1024*1024)
            image_url = inline_image(source)
        ai = directory / "ai.mp4"
        prompt = "A gentle realistic camera push toward the exact product shown in the reference. The product stays stationary and fully visible. Preserve its shape, color, proportions, material, labels, printed text and all details. No rotation, no invented functionality, no demonstrations of unsupported effects, no hands, no people, no new accessories, no additional text. Smooth natural motion in the existing scene."
        if payload["provider"] == "fal":
            result = paid_fal(directory, state, "motion", "fal-ai/wan/v2.2-a14b/image-to-video/turbo", {
                "image_url": image_url, "prompt": prompt, "resolution": "480p", "aspect_ratio": "9:16", "enable_safety_checker": True, "enable_output_safety_checker": True, "enable_prompt_expansion": False,
            }, 5, allowance)
            download(result["video"]["url"], ai, "artifact", 40*1024*1024)
        else:
            # Remote Modal GPU only. There is deliberately no local-Wan import.
            state["stages"]["motion"] = {"model": "tolley-shop-videos/motion", "estimatedCents": 150, "status": "submitting"}
            write_state(directory, state)
            fn = modal.Function.from_name(APP, "motion")
            call = fn.spawn(job_id=payload["job_id"], image_bytes=source.read_bytes(), prompt=prompt)
            state["stages"]["motion"].update({"request_id": call.object_id, "status": "queued"})
            write_state(directory, state)
            try:
                ai.write_bytes(call.get(timeout=900))
            except (TimeoutError, modal.exception.TimeoutError):
                call.cancel()
                raise HeldJob("Modal GPU exceeded the execution window; check the saved call before generating again") from None
            state["stages"]["motion"]["status"] = "complete"
            write_state(directory, state)
        partial = directory / "output.part.mp4"
        meta = assemble(ai, real, partial, overlay, payload["format"])
        partial.replace(directory / "output.mp4")
        data = (directory / "output.mp4").read_bytes()
        receipts = [{k: s[k] for k in ("model", "request_id", "estimatedCents") if k in s} for s in state["stages"].values()]
        result = {"status": "ready", **meta, "size": len(data), "sha256": hashlib.sha256(data).hexdigest(), "providerEstimateCents": sum(s["estimatedCents"] for s in state["stages"].values()), "receipts": receipts}
    except HeldJob as exc:
        result = {"status": "held", "error": str(exc), "providerEstimateCents": sum(s.get("estimatedCents", 0) for s in state["stages"].values()), "receipts": [{k: s[k] for k in ("model", "request_id", "estimatedCents") if k in s} for s in state["stages"].values()]}
    except Exception as exc:
        # Providers/ffmpeg can echo private media or credentials. Keep raw errors out.
        result = {"status": "failed", "error": str(exc)[:300] if isinstance(exc, ValueError) else f"Cloud render failed ({type(exc).__name__}); inspect this job in Modal", "providerEstimateCents": sum(s.get("estimatedCents", 0) for s in state["stages"].values()), "receipts": [{k: s[k] for k in ("model", "request_id", "estimatedCents") if k in s} for s in state["stages"].values()]}
    result_file.write_text(json.dumps(result))
    volume.commit()
    return result


@app.function(image=image, secrets=[secret], volumes={"/data": volume}, timeout=2400, retries=0, cpu=2, memory=2048, max_containers=3, scaledown_window=5)
def render(payload: dict):
    if payload.get("provider") != "fal":
        raise ValueError("Use the serial Modal render queue for GPU jobs")
    return render_job(payload)


@app.function(image=image, secrets=[secret], volumes={"/data": volume}, timeout=2400, retries=0, cpu=2, memory=2048, max_containers=1, scaledown_window=5)
def render_modal(payload: dict):
    if payload.get("provider") != "modal":
        raise ValueError("Use the fal render queue for fal jobs")
    return render_job(payload)


@app.function(image=image, volumes={"/data": volume}, timeout=30, cpu=0.25, memory=256, scaledown_window=5)
def read_result(job_id: str):
    """Recover a completed durable result without submitting generation again."""
    volume.reload()
    path = job_dir(job_id) / "result.json"
    return json.loads(path.read_text()) if path.is_file() else None


@app.function(image=image, volumes={"/data": volume}, timeout=60, cpu=0.25, memory=512, scaledown_window=5)
def read_output(job_id: str, start: int = 0, end: int = -1):
    volume.reload()
    path = job_dir(job_id) / "output.mp4"
    size = path.stat().st_size
    if end == -1:
        end = size-1
    if not 0 <= start <= end < size or end-start >= 40*1024*1024:
        raise ValueError("Invalid output byte range")
    with path.open("rb") as handle:
        handle.seek(start)
        return base64.b64encode(handle.read(end-start+1)).decode()


@app.function(image=image, volumes={"/data": volume}, timeout=180, cpu=2, memory=1024)
def assembly_smoke():
    """CPU-only acceptance test, never calls a generation provider."""
    directory = job_dir("assembly-smoke-v1")
    directory.mkdir(parents=True, exist_ok=True)
    src = directory / "ai.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=480x848:rate=30", "-t", "4", "-c:v", "libx264", "-threads", "2", str(src)], check=True, timeout=60)
    meta = assemble(src, None, directory / "output.mp4", "Store Display acceptance test", "boomerang")
    hybrid = assemble(src, src, directory / "hybrid.mp4", "100% literal %{test} overlay", "hybrid")
    streams = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(directory / "hybrid.mp4")], capture_output=True, check=True).stdout)["streams"]
    if len(streams) != 1 or streams[0]["codec_type"] != "video" or int(streams[0]["nb_frames"]) != 240:
        raise ValueError("Hybrid frame count/audio acceptance failed")
    try:
        assemble(src, None, directory / "invalid.mp4", "Invalid hybrid", "hybrid")
    except ValueError:
        pass
    else:
        raise ValueError("Missing footage was accepted")
    volume.commit()
    return {**meta, "size": (directory / "output.mp4").stat().st_size, "job_id": "assembly-smoke-v1", "hybrid": hybrid, "frames": 240, "audio": False}
