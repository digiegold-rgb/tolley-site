"""Local-only keyword recognition; no audio or transcripts are stored or uploaded."""
import asyncio
from contextlib import asynccontextmanager, suppress
import hmac
import json
import os
from pathlib import Path
import time
import uuid

import httpx
from fastapi import FastAPI, HTTPException, Request
from core import KeywordGate, allowed, KEYWORDS, COOLDOWN

ROOT = Path.home() / "stream-director/voice-effects"
MODEL = Path(os.environ.get("VOICE_MODEL", str(Path.home() / ".cache/tolley-voice/vosk-model-small-en-us-0.15")))
SETTINGS = Path.home() / ".local/state/tolley-voice-effects/settings.json"


def env_file(path):
    return dict(line.strip().split("=", 1) for line in path.read_text().splitlines()
                if "=" in line and not line.lstrip().startswith("#"))


class Listener:
    def __init__(self):
        self.enabled = True
        if SETTINGS.exists():
            self.enabled = bool(json.loads(SETTINGS.read_text()).get("enabled", True))
        self.gate = {}
        self.checked = 0.0
        self.state = "starting"
        self.error = ""
        self.last_cue = None
        self.last_pcm = None
        self.model = None
        self.capture = None
        self.process = None
        self.keywords = KeywordGate()
        self.client = None
        self.agent = None
        self.keys = []
        self.audio_url = None

    def authorize(self, request):
        supplied = request.headers.get("x-api-key", "")
        if not supplied or not any(hmac.compare_digest(supplied, key) for key in self.keys):
            raise HTTPException(401, "Unauthorized")

    def ready(self, epoch=None, mic=None):
        return (self.enabled and allowed(self.gate) and time.monotonic() - self.checked < 3
                and (epoch is None or epoch == self.gate.get("epoch"))
                and (mic is None or mic == self.gate.get("micSlot")))

    def snapshot(self):
        return {"enabled": self.enabled, "state": self.state, "error": self.error,
                "keywords": sorted(KEYWORDS), "cooldownSeconds": COOLDOWN,
                "modelReady": self.model is not None, "lastCue": self.last_cue,
                "audioAgeSeconds": round(time.monotonic() - self.last_pcm, 1) if self.last_pcm else None,
                "storesAudio": False, "storesTranscripts": False}

    async def stop_capture(self):
        task, self.capture = self.capture, None
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await task
        self.last_pcm = None

    async def decode(self, epoch, mic):
        from vosk import KaldiRecognizer
        recognizer = KaldiRecognizer(self.model, 16000)
        recognizer.SetWords(True)
        self.keywords.reset_audio()
        proc = None
        audio_started = None
        audio_bytes = 0
        try:
            # Read the finished, unkeyed program: it follows OBS's actual audio lock.
            # Never connect to a private camera path or monitor an off-air microphone.
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
                "-rtsp_transport", "tcp", "-rw_timeout", "2000000", "-fflags", "nobuffer",
                "-i", self.audio_url, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "pipe:1",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
            self.process = proc
            while self.ready(epoch, mic):
                pcm = await asyncio.wait_for(proc.stdout.read(4000), timeout=3)
                if not pcm:
                    raise RuntimeError("Program audio disconnected")
                self.last_pcm = time.monotonic()
                if audio_started is None:
                    audio_started = self.last_pcm
                audio_bytes += len(pcm)
                if self.last_pcm - audio_started - audio_bytes / 32000 > 2:
                    raise RuntimeError("Audio decoding fell behind; discard buffered speech")
                self.state, self.error = "listening", ""
                final = await asyncio.to_thread(recognizer.AcceptWaveform, pcm)
                if final:
                    result = json.loads(recognizer.Result())
                    keyword = self.keywords.recognize(result, self.ready(epoch, mic))
                    if keyword:
                        event_id = str(uuid.uuid4())
                        r = await self.client.post(self.agent["STREAM_URL"].rstrip("/") + "/effects/firework",
                            headers={"x-api-key": self.agent["STREAM_KEY"]},
                            json={"id": event_id, "epoch": epoch, "at": time.time()}, timeout=2)
                        if r.is_success:
                            self.last_cue = {"keyword": keyword, "at": time.time(), "id": event_id}
                        elif r.status_code not in (409, 429):
                            self.error = "The director could not play the effect. Check the overlay installation."
        except asyncio.CancelledError:
            raise
        except Exception:
            self.state, self.error = "reconnecting", "Program audio or effect connection unavailable; retrying."
        finally:
            # Do not flush FinalResult: buffered speech from an ended/private show must never fire.
            if proc and proc.returncode is None:
                proc.terminate()
                try:
                    await asyncio.wait_for(proc.wait(), 2)
                except asyncio.TimeoutError:
                    proc.kill()
                    await proc.wait()
            self.process = None

    async def run(self):
        self.agent = env_file(Path.home() / ".config/tolley-stream/agent.env")
        secrets = env_file(Path.home() / ".config/tolley-security/stream.env")
        self.keys = [v for k, v in secrets.items() if k == "STREAM_API_KEY" or k.startswith("AGENT_KEY_")]
        self.audio_url = f"rtsp://{secrets.get('MEDIAMTX_HOST', '192.168.2.196')}:8554/program"
        try:
            from vosk import Model, SetLogLevel
            SetLogLevel(-1)
            self.model = await asyncio.to_thread(Model, str(MODEL))
        except Exception:
            self.state, self.error = "unavailable", "The local speech model could not load."
            return
        self.state = "idle"
        async with httpx.AsyncClient(timeout=2, trust_env=False) as self.client:
            try:
                while True:
                    previous = (self.gate.get("epoch"), self.gate.get("micSlot"))
                    try:
                        r = await self.client.get(self.agent["STREAM_URL"].rstrip("/") + "/effects/gate",
                                                headers={"x-api-key": self.agent["STREAM_KEY"]})
                        r.raise_for_status()
                        self.gate, self.checked = r.json(), time.monotonic()
                    except Exception:
                        self.gate = {}
                        self.state, self.error = "waiting", "Director unavailable; voice effects are paused."
                    if previous != (self.gate.get("epoch"), self.gate.get("micSlot")) or not self.ready():
                        await self.stop_capture()
                    if self.ready() and (self.capture is None or self.capture.done()):
                        self.capture = asyncio.create_task(self.decode(self.gate["epoch"], self.gate["micSlot"]))
                    elif not self.ready() and self.gate:
                        self.state = "idle" if self.enabled else "disabled"
                        self.error = ""
                    await asyncio.sleep(0.5)
            finally:
                await self.stop_capture()


listener = Listener()


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(listener.run())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/status")
async def status(request: Request):
    listener.authorize(request)
    return listener.snapshot()


@app.post("/settings")
async def settings(request: Request):
    listener.authorize(request)
    raw = await request.body()
    if len(raw) > 1000:
        raise HTTPException(413, "Request too large")
    try:
        body = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "Invalid JSON")
    if not isinstance(body, dict) or type(body.get("enabled")) is not bool:
        raise HTTPException(400, "Choose enabled true or false")
    SETTINGS.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    tmp = SETTINGS.with_suffix(".tmp")
    tmp.write_text(json.dumps({"enabled": body["enabled"]}))
    tmp.chmod(0o600)
    tmp.replace(SETTINGS)
    listener.enabled = body["enabled"]
    if not listener.enabled:
        await listener.stop_capture()
        listener.state = "disabled"
    return listener.snapshot()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8110, access_log=False)
