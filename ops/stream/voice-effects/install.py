"""Add the voice service and one OBS input only while the house is idle.

Run with stream-director/.venv/bin/python (already has obsws_python/httpx).
The voice service has a separate venv and never changes the director's packages.
"""
import json
import logging
from pathlib import Path
import shutil
import socket
import subprocess
import time

import httpx
import obsws_python as obsws

HERE = Path(__file__).resolve().parent
HOME = Path.home()
DIRECTOR = HOME / "stream-director"
TARGET = DIRECTOR / "voice-effects"
ASSET = HOME / ".local/share/tolley-stream-effects/fireworks-portrait.mov"
logging.getLogger("obsws_python").setLevel(logging.WARNING)


def read_env(path):
    return dict(line.strip().split("=", 1) for line in path.read_text().splitlines()
                if "=" in line and not line.lstrip().startswith("#"))


agent = read_env(HOME / ".config/tolley-stream/agent.env")
secrets = read_env(HOME / ".config/tolley-security/stream.env")


def idle():
    r = httpx.get(agent["STREAM_URL"].rstrip("/") + "/status",
                  headers={"x-api-key": agent["STREAM_KEY"]}, timeout=5, trust_env=False)
    r.raise_for_status()
    s = r.json()
    if s["armed"] or s["obs"]["streaming"] or any(d["running"] for d in s["destinations"].values()):
        raise SystemExit("House armed/encoding/sending: voice-effects installation deferred.")


idle()
if not ASSET.exists():
    raise SystemExit("Render the transparent fireworks asset first.")
if not (DIRECTOR / ".voice-venv/bin/python").exists():
    raise SystemExit("Create the separate voice venv and install requirements first.")
for path in HERE.glob("*.py"):
    compile(path.read_text(), str(path), "exec")
with socket.socket() as probe:
    occupied = probe.connect_ex(("127.0.0.1", 8110)) == 0
if occupied and subprocess.run(["systemctl", "--user", "is-active", "--quiet", "tolley-voice-effects"]).returncode:
    raise SystemExit("Port 8110 is occupied by another service.")
source = (DIRECTOR / "director.py").read_text()
marker = "from voice_effects_routes import install as install_voice_effects"
if marker not in source:
    anchor = 'if __name__ == "__main__":'
    if source.count(anchor) != 1:
        raise SystemExit("Unexpected director layout; installation deferred.")
    source = source.replace(anchor, marker + "\ninstall_voice_effects(app, require_key, STATE, OBS_STATE, OBSC, obs_run, status_payload)\n\n\n" + anchor)
compile(source, "director.py", "exec")
idle()
stamp = str(int(time.time()))
TARGET.mkdir(parents=True, exist_ok=True)
for name in ("service.py", "core.py", "control.py", "README.md"):
    dst = TARGET / name
    if dst.exists():
        shutil.copy2(dst, dst.with_name(name + ".before-" + stamp))
    shutil.copy2(HERE / name, dst)
route = DIRECTOR / "voice_effects_routes.py"
restart = source != (DIRECTOR / "director.py").read_text() or not route.exists() or route.read_bytes() != (HERE / "director_routes.py").read_bytes()
if route.exists():
    shutil.copy2(route, route.with_name(route.name + ".before-" + stamp))
shutil.copy2(HERE / "director_routes.py", route)
if source != (DIRECTOR / "director.py").read_text():
    shutil.copy2(DIRECTOR / "director.py", DIRECTOR / ("director.py.before-voice-" + stamp))
    (DIRECTOR / "director.py").write_text(source)
if restart:
    idle()
    subprocess.run(["systemctl", "--user", "restart", "stream-director"], check=True)
    for attempt in range(30):
        time.sleep(1)
        try:
            idle()
            break
        except httpx.HTTPError:
            pass
    else:
        raise SystemExit("Director did not restart; inspect before proceeding.")

client = obsws.ReqClient(host=secrets.get("OBS_WS_HOST", "127.0.0.1"),
    port=int(secrets.get("OBS_WS_PORT", "4455")), password=secrets["OBS_WS_PASSWORD"], timeout=5)


def safe_call(method, *args):
    idle()
    if client.get_stream_status().output_active or client.get_record_status().output_active:
        raise SystemExit("OBS output active: input configuration deferred.")
    return getattr(client, method)(*args)


name = "Voice Fireworks"
settings = {"is_local_file": True, "local_file": str(ASSET), "looping": False,
            "restart_on_activate": False, "close_when_inactive": False,
            "clear_on_media_end": True, "hw_decode": False}
inputs = {i["inputName"] for i in client.get_input_list().inputs}
if name not in inputs:
    safe_call("create_input", "Live", name, "ffmpeg_source", settings, True)
elif client.get_input_settings(name).input_settings.get("local_file") != str(ASSET):
    raise SystemExit("An unrelated input already uses Voice Fireworks; inspect it before replacing.")
else:
    safe_call("set_input_settings", name, settings, True)
items = client.get_scene_item_list("Live").scene_items
item = next((i for i in items if i["sourceName"] == name), None)
if item is None:
    raise SystemExit("Voice Fireworks exists outside Live; inspect before linking.")
video = client.get_video_settings()
safe_call("set_scene_item_transform", "Live", item["sceneItemId"], {
    "positionX": 0, "positionY": 0, "alignment": 5, "boundsType": "OBS_BOUNDS_STRETCH",
    "boundsWidth": video.base_width, "boundsHeight": video.base_height})
safe_call("set_scene_item_index", "Live", item["sceneItemId"], len(items)-1)
safe_call("set_scene_item_enabled", "Live", item["sceneItemId"], True)
safe_call("trigger_media_input_action", name, "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP")

cli = DIRECTOR / "agents/stream"
cli_source = cli.read_text()
if "  effects)" not in cli_source:
    anchor = '  status)'
    if cli_source.count(anchor) != 1:
        raise SystemExit("Unexpected stream CLI layout")
    shutil.copy2(cli, cli.with_name("stream.before-voice-" + stamp))
    cli.write_text(cli_source.replace(anchor, '  effects) shift; exec "$HOME/stream-director/.voice-venv/bin/python" "$HOME/stream-director/voice-effects/control.py" "$@" ;;\n' + anchor))

guide = DIRECTOR / "agents/STREAM-AGENTS.md"
section = "## Spoken visual effects"
if section not in guide.read_text():
    notes = (HERE.parent / "STREAM-AGENTS.md").read_text().split(section, 1)[1]
    guide.write_text(guide.read_text().rstrip() + "\n\n" + section + notes)

shutil.copy2(HERE / "tolley-voice-effects.service", HOME / ".config/systemd/user/tolley-voice-effects.service")
subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
subprocess.run(["systemctl", "--user", "enable", "tolley-voice-effects"], check=True)
subprocess.run(["systemctl", "--user", "restart", "tolley-voice-effects"], check=True)
for attempt in range(20):
    time.sleep(1)
    r = httpx.get(agent["STREAM_URL"].rstrip("/") + "/effects/status",
                 headers={"x-api-key": agent["STREAM_KEY"]}, timeout=5, trust_env=False)
    if r.is_success and r.json().get("modelReady"):
        print(json.dumps(r.json(), indent=2))
        print("Voice effects installed. No show was started; the listener waits for live program audio.")
        break
else:
    raise SystemExit("Voice service health check failed; inspect logs before a show.")
