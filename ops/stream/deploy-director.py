#!/usr/bin/env python3
"""Idempotent health-probe installation. Run only while the house is idle."""
from pathlib import Path
import importlib.util, shutil, subprocess, time
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('clips',HERE/'clip-worker.py');clips=importlib.util.module_from_spec(spec);spec.loader.exec_module(clips)
status=clips.director()
if status['armed'] or status['obs']['streaming']: raise SystemExit('House is armed/encoding: installation deferred')
target=Path.home()/'stream-director/director.py'
s=target.read_text()
if 'from recording_health import probe as probe_recording' not in s:
    shutil.copy2(target,target.with_name(f'director.py.before-health-{int(time.time())}'))
    s=s.replace('import httpx\n','import httpx\nfrom recording_health import probe as probe_recording\n')
    s=s.replace('async def tick(cam_was: bool | None) -> None:', '''RECORDING_HEALTH = {"state": "unknown", "ageS": None, "bytes": 0}
RECORDING_CHECKED = 0.0
RECORDING_TASK = None

async def refresh_recording_health():
    global RECORDING_HEALTH, RECORDING_CHECKED
    RECORDING_HEALTH = await asyncio.to_thread(probe_recording, bool(OBS_STATE["obs_streaming"]))
    RECORDING_CHECKED = time.time()

async def tick(cam_was: bool | None) -> None:''')
    s=s.replace('    if not STATE.armed:\n        stop_thumbs()', '''    global RECORDING_TASK
    if now - RECORDING_CHECKED > 30 and (RECORDING_TASK is None or RECORDING_TASK.done()):
        RECORDING_TASK = asyncio.create_task(refresh_recording_health())
    if not STATE.armed:
        stop_thumbs()''',1)
    s=s.replace('        "mediamtx": {"ok": OBS_STATE["mtx_ok"]},','        "recording": RECORDING_HEALTH if now - RECORDING_CHECKED < 90 else {"state": "unknown", "ageS": None, "bytes": 0},\n        "mediamtx": {"ok": OBS_STATE["mtx_ok"]},',1)
    compile(s,str(target),'exec');target.write_text(s)
shutil.copy2(HERE/'recording_health.py',target.parent/'recording_health.py')
shutil.copy2(HERE/'STREAM-AGENTS.md',target.parent/'agents/STREAM-AGENTS.md')
subprocess.run(['systemctl','--user','restart','stream-director'],check=True)
