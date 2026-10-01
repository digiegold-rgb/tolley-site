#!/usr/bin/env python3
"""Install Facebook support without replacing the director's other integrations."""
from pathlib import Path
import argparse
import shutil
import subprocess
import time

HERE = Path(__file__).resolve().parent


def patched(source):
    if "# Facebook preview integration v1" in source:
        return source

    def replace(old, new):
        nonlocal source
        if source.count(old) != 1:
            raise RuntimeError("Director changed: review installation anchors before installing")
        source = source.replace(old, new, 1)

    replace('DESTINATIONS = ("youtube", "tiktok", "whatnot")',
            'DESTINATIONS = ("youtube", "tiktok", "whatnot", "facebook")')
    replace('import httpx\n', 'import httpx\n# Facebook preview integration v1\nfrom facebook_live import FacebookLive, install as install_facebook\nFACEBOOK = FacebookLive()\n')
    replace('def dest_target(name: str) -> str | None:\n',
            'def dest_target(name: str) -> str | None:\n    if name == "facebook":\n        return FACEBOOK.target()\n')
    replace('STATE = State()\n', 'STATE = State()\n# Never resume a Facebook sender after a director restart.\nSTATE.destinations["facebook"] = False\n')
    replace('self.proc = subprocess.Popen(cmd, stdout=self.log, stderr=self.log, start_new_session=True)',
            '# FFmpeg errors can echo the full ingest URL. Never log Facebook credentials.\n        output = subprocess.DEVNULL if self.name == "facebook" else self.log\n        self.proc = subprocess.Popen(cmd, stdout=output, stderr=output, start_new_session=True)')
    replace('    STATE.armed = False\n    STATE.privacy = False\n',
            '    STATE.armed = False\n    STATE.destinations["facebook"] = False\n    STATE.privacy = False\n')
    replace('async def do_go_live(dests: dict[str, bool], studio: bool = True) -> None:\n',
            'async def do_go_live(dests: dict[str, bool], studio: bool = True) -> None:\n    if dests.get("facebook"):\n        raise HTTPException(409, "Use Facebook Send preview after arming the house")\n')
    replace('async def destinations(body: dict) -> dict:\n',
            'async def destinations(body: dict) -> dict:\n    if body.get("facebook") and not STATE.destinations.get("facebook"):\n        raise HTTPException(409, "Use Facebook Send preview to enable this destination")\n')
    replace('        "mediamtx": {"ok": OBS_STATE["mtx_ok"]},',
            '        "facebook": dict(FACEBOOK.meta),\n        "mediamtx": {"ok": OBS_STATE["mtx_ok"]},')
    replace('async def chat(since: int = 0, limit: int = 80) -> JSONResponse:',
            'async def chat(since: int = 0, limit: int = 80, epoch: str = "") -> JSONResponse:')
    replace('params={"since": since, "limit": limit}',
            'params={"since": since, "limit": limit, "epoch": epoch}')
    replace('if __name__ == "__main__":\n',
            'install_facebook(app, require_key, STATE, OBS_STATE, PUSHERS, status_payload, FACEBOOK)\n\n\nif __name__ == "__main__":\n')
    compile(source, "director.py", "exec")
    return source


def patched_v2(source):
    """Second pass: /status reports the tail of the loaded Facebook key (Live Producer keys are pasted, so
    operators confirm the right key by its last characters). Idempotent; requires the v1 patch."""
    if "# Facebook preview integration v2" in source:
        return source
    old = 'def dest_key_tail(name: str) -> str:\n    return ENV.get(f"{name.upper()}_STREAM_KEY", "").strip()[-6:]\n'
    if source.count(old) != 1 or "FACEBOOK = FacebookLive()" not in source:
        raise RuntimeError("Director changed: review installation anchors before installing")
    source = source.replace(old, 'def dest_key_tail(name: str) -> str:\n    if name == "facebook":  # Facebook preview integration v2\n'
                            '        return FACEBOOK.key_tail()\n    return ENV.get(f"{name.upper()}_STREAM_KEY", "").strip()[-6:]\n', 1)
    compile(source, "director.py", "exec")
    return source


def status():
    import httpx
    env = dict(line.split("=", 1) for line in (Path.home()/".config/tolley-stream/agent.env").read_text().splitlines() if "=" in line and not line.startswith("#"))
    # agent.env is a shell file; strip only surrounding quotes, never execute it.
    env = {key.removeprefix("export "): value.strip("\"'") for key, value in env.items()}
    r = httpx.get(env["STREAM_URL"] + "/status", headers={"x-api-key": env["STREAM_KEY"]}, timeout=8)
    if r.status_code != 200:
        raise RuntimeError("Cannot verify director state")
    return r.json()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    root = Path.home()/"stream-director"
    target = root/"director.py"
    source = patched_v2(patched(target.read_text()))
    cli = root/"agents/stream"
    cli_source = cli.read_text()
    if '  facebook) shift;' not in cli_source:
        anchor = '  effects) shift;'
        if cli_source.count(anchor) != 1:
            raise SystemExit("Unexpected stream CLI layout; installation deferred")
        cli_source = cli_source.replace(anchor, '  facebook) shift; exec "$HOME/stream-director/.venv/bin/python" "$HOME/stream-director/facebook-control.py" "$@" ;;\n' + anchor)
    for path in [HERE/"facebook_live.py", HERE/"control.py", HERE.parent/"coach/stream_chat.py"]:
        compile(path.read_text(), str(path), "exec")
    if args.check:
        print("Director patch and Python sources compile; no services changed")
        return
    current = status()
    if current["armed"] or current["obs"]["streaming"] or any(d.get("running") for d in current["destinations"].values()):
        raise SystemExit("House armed/encoding: no installation performed")
    backup = root/f"facebook-backup-{int(time.time())}"
    backup.mkdir(mode=0o700)
    for name in ("director.py", "stream_chat.py", "facebook_live.py"):
        if (root/name).exists():
            shutil.copy2(root/name, backup/name)
    shutil.copy2(cli, backup/"stream-cli")
    shutil.copy2(HERE/"control.py", root/"facebook-control.py")
    cli.write_text(cli_source)
    shutil.copy2(HERE/"facebook_live.py", root/"facebook_live.py")
    shutil.copy2(HERE.parent/"coach/stream_chat.py", root/"stream_chat.py")
    target.write_text(source)
    subprocess.run(["systemctl", "--user", "restart", "stream-director", "stream-chat"], check=True)
    print(f"Installed Facebook preview and comments. Source backup: {backup}. No broadcast started.")


if __name__ == "__main__":
    main()
