"""Install the coach and authenticated proxy only while the house is idle."""
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import time
import httpx

HERE=Path(__file__).resolve().parent
HOME=Path.home()
config={}
for line in (HOME/'.config/tolley-stream/agent.env').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k,v=line.split('=',1);config[k.strip()]=v.strip()
def status():
    r=httpx.get(config['STREAM_URL'].rstrip('/')+'/status',headers={'x-api-key':config['STREAM_KEY']},timeout=10)
    r.raise_for_status()
    return r.json()
def idle():
    s=status()
    if s.get('armed') or s.get('obs',{}).get('streaming') or any(d.get('running') for d in s.get('destinations',{}).values()):
        raise SystemExit('House armed/encoding/sending: coach installation deferred.')
idle()
with socket.socket() as probe:
    occupied=probe.connect_ex(('127.0.0.1',8106))==0
if occupied and subprocess.run(['systemctl','--user','is-active','--quiet','tolley-stream-coach']).returncode!=0:
    raise SystemExit('Coach port 8106 is already occupied by another service; installation deferred.')
files={'coach_service.py':'service.py','coach_director_routes.py':'director_routes.py',
       'automatic.py':'automatic.py','source_metadata.py':'source_metadata.py',
       'youtube_metrics.py':'youtube_metrics.py','stream_chat.py':'stream_chat.py',
       'whatnot-observer.mjs':'whatnot-observer.mjs'}
for name in files.values():
    if not name.endswith('.py'):continue
    compile((HERE/name).read_text(),name,'exec')
target=HOME/'stream-director/director.py'
source=target.read_text()
marker='from coach_director_routes import install as install_coach_routes'
if marker not in source:
    anchor='if __name__ == "__main__":'
    if source.count(anchor)!=1:raise SystemExit('Unexpected director layout; installation deferred.')
    source=source.replace(anchor,marker+'\ninstall_coach_routes(app, require_key)\n\n\n'+anchor)
compile(source,str(target),'exec')
# Recheck immediately before changing the service; never restart an armed house.
idle()
stamp=str(int(time.time()))
state=HOME/'.local/state/tolley-stream-coach'
database=state/'coach.sqlite3'
if database.exists():
    backup=state/('coach.sqlite3.before-auto-'+stamp)
    with sqlite3.connect(database) as src,sqlite3.connect(backup) as dst:src.backup(dst)
    backup.chmod(0o600)
route=target.parent/'coach_director_routes.py'
restart_director=source!=target.read_text() or not route.exists() or route.read_bytes()!=(HERE/'director_routes.py').read_bytes()
for name,src in files.items():
    dst=target.parent/name
    if dst.exists():shutil.copy2(dst,dst.with_name(name+'.before-'+stamp))
    shutil.copy2(HERE/src,dst)
if source!=target.read_text():
    shutil.copy2(target,target.with_name('director.py.before-coach-'+stamp))
    target.write_text(source)
for name in ['tolley-stream-coach.service','tolley-whatnot-observer.service']:
    shutil.copy2(HERE/name,HOME/'.config/systemd/user'/name)
subprocess.run(['systemctl','--user','daemon-reload'],check=True)
subprocess.run(['systemctl','--user','enable','tolley-stream-coach','tolley-whatnot-observer'],check=True)
# These services only read platform data. The broadcasting director is unchanged
# on an automation upgrade and is deliberately not restarted in that case.
subprocess.run(['systemctl','--user','restart','stream-chat','tolley-stream-coach','tolley-whatnot-observer'],check=True)
if restart_director:
    idle()
    subprocess.run(['systemctl','--user','restart','stream-director'],check=True)
for _ in range(20):
    try:
        r=httpx.get(config['STREAM_URL'].rstrip('/')+'/coach/snapshot',headers={'x-api-key':config['STREAM_KEY']},timeout=3)
        if r.status_code==200:
            print('Automatic tracking installed; authenticated snapshot reachable. Broadcast controls unchanged.')
            break
    except httpx.HTTPError:pass
    time.sleep(1)
else:raise SystemExit('Coach health check failed. Inspect the services before deploying the web page.')
