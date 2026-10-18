"""Only the director controls OBS. Speech can request this single, gated visual."""
import asyncio
from collections import deque
import json
import math
from pathlib import Path
import time

import httpx
from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse

SOURCE = "Voice Fireworks"


def install(app, require_key, state, obs_state, obs, obs_run, status_payload):
    lock = asyncio.Lock()
    seen = deque(maxlen=100)
    expiry_tasks = set()
    last_trigger = -math.inf
    settings = Path.home() / ".local/state/tolley-voice-effects/settings.json"
    try:
        enabled = bool(json.loads(settings.read_text()).get("enabled", True)) if settings.exists() else True
    except (OSError, ValueError):
        enabled = False

    async def expire(event_id):
        await asyncio.sleep(6.2)
        async with lock:
            # A hidden media source can pause rather than finish. Expire by wall clock,
            # but never stop a newer cue if the event loop was delayed.
            if seen and seen[-1] == event_id:
                try:
                    await obs_run(obs.call, "trigger_media_input_action", SOURCE, "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP")
                except Exception:
                    state.event("effect", "Fireworks expiry needs an OBS connection")

    @app.on_event("startup")
    async def clear_old_effect():
        try:
            await obs_run(obs.call, "trigger_media_input_action", SOURCE, "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP")
        except Exception:
            pass  # Input may not exist yet during first installation.

    def gate():
        status = status_payload()
        mic = next((c["slot"] for c in status["cameras"] if c["audioLive"] and c["connected"]), None)
        return {"allowed": bool(enabled and state.armed and not state.privacy and mic
                                and obs_state["obs_streaming"] and obs_state["program_ready"]
                                and obs_state["obs_scene"] == "Live"),
                "epoch": state.live_since, "micSlot": mic}

    @app.get("/effects/gate", dependencies=[Depends(require_key)])
    async def effects_gate():
        return gate()

    @app.api_route("/effects/{path}", methods=["GET", "POST"], dependencies=[Depends(require_key)])
    async def effects(path: str, request: Request):
        nonlocal last_trigger, enabled
        if path in ("status", "settings"):
            if request.method != ("GET" if path == "status" else "POST"):
                raise HTTPException(405, "Method not allowed")
            raw = await request.body()
            if len(raw) > 1000:
                raise HTTPException(413, "Request too large")
            try:
                async with httpx.AsyncClient(timeout=3, trust_env=False) as client:
                    r = await client.request(request.method, f"http://127.0.0.1:8110/{path}", content=raw,
                        headers={"x-api-key": request.headers.get("x-api-key", ""), "content-type": "application/json"})
                    body = r.json()
                    if r.is_success and type(body.get("enabled")) is bool:
                        enabled = body["enabled"]
                    return JSONResponse(body, status_code=r.status_code, headers={"Cache-Control": "no-store"})
            except Exception:
                raise HTTPException(503, "Voice effects service unavailable")
        if path not in ("firework", "test") or request.method != "POST":
            raise HTTPException(404, "Not found")
        raw = await request.body()
        if len(raw) > 1000:
            raise HTTPException(413, "Request too large")
        try:
            body = json.loads(raw)
        except ValueError:
            raise HTTPException(400, "Invalid JSON")
        if not isinstance(body, dict) or not isinstance(body.get("id"), str) or not 1 <= len(body["id"]) <= 80:
            raise HTTPException(400, "Event identifier required")
        at = body.get("at")
        if not isinstance(at, (int, float)) or not math.isfinite(at) or not -1 <= time.time() - at <= 3:
            raise HTTPException(409, "Expired cue")
        async with lock:
            if time.time() - at > 3:
                raise HTTPException(409, "Expired cue")
            if body["id"] in seen:
                return {"ok": True, "replay": True}
            current = gate()
            if path == "test":
                if state.armed or obs_state["obs_streaming"]:
                    raise HTTPException(409, "Test only while the house is idle")
                if await obs_run(lambda: bool(obs.call("get_stream_status").output_active or obs.call("get_record_status").output_active)):
                    raise HTTPException(409, "An OBS output is active")
            else:
                if not current["allowed"] or body.get("epoch") != current["epoch"]:
                    raise HTTPException(409, "Show is not accepting effects")
                if await obs_run(obs.scene) != "Live" or not gate()["allowed"]:
                    raise HTTPException(409, "Program scene changed")
            if time.monotonic() - last_trigger < 12:
                raise HTTPException(429, "Effect cooldown")
            # No recognized text, source name, path, or command is ever accepted from speech.
            await obs_run(obs.call, "trigger_media_input_action", SOURCE, "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART")
            last_trigger = time.monotonic()
            seen.append(body["id"])
            task = asyncio.create_task(expire(body["id"]))
            expiry_tasks.add(task)
            task.add_done_callback(expiry_tasks.discard)
            state.event("effect", "Voice fireworks" if path == "firework" else "Off-air fireworks test")
            return {"ok": True, "effect": "fireworks", "seconds": 5.8}
