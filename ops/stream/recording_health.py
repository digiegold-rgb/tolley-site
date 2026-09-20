"""Read-only NAS recording health probe, independent of OBS/MediaMTX controls."""
import subprocess
import time

ARCHIVE = '/volume1/UserFolder/Jared/stream-recordings/program/'

def classify(latest_mtime, size, encoding, now=None):
    now = time.time() if now is None else now
    age = max(0, int(now - latest_mtime)) if latest_mtime else None
    state = ('recording' if age is not None and age < 90 and size > 0 else 'stale') if encoding else 'idle'
    return {'state': state, 'ageS': age, 'bytes': size}

def probe(encoding):
    try:
        result = subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=5','Jared@192.168.2.196',
            "find " + ARCHIVE + " -maxdepth 1 -name '*.mp4' -exec stat -c '%Y %s' {} \\;"], capture_output=True, text=True, timeout=8, check=True)
        entries=[tuple(map(int,line.split())) for line in result.stdout.splitlines() if len(line.split())==2]
        latest=max(entries, default=(0,0))
        return classify(latest[0],latest[1],encoding)
    except Exception:
        return {'state':'unknown','ageS':None,'bytes':0,'error':'NAS recording check unavailable'}
