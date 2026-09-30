#!/usr/bin/env python3
"""Install paused V2 and read-only catalog timer; director must be idle."""
from pathlib import Path
import subprocess, shutil, time, importlib.util
HERE = Path(__file__).resolve().parent
HOME = Path.home()

def main():
    spec = importlib.util.spec_from_file_location('facebook_installer', HERE.parent/'facebook/install.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    s = module.status()
    if s['armed'] or s['obs']['streaming'] or any(d.get('running') for d in s['destinations'].values()):
        raise SystemExit('House active: no installation performed. Do not interrupt a live show.')
    root=HOME/'whatnot-inventory-bot'; root.mkdir(mode=0o700,exist_ok=True)
    for src in HERE.glob('*.mjs'): shutil.copy2(src,root/src.name)
    shutil.copytree(HERE/'web',root/'web',dirs_exist_ok=True)
    shutil.copy2(HERE/'package.json',root/'package.json')
    units=HOME/'.config/systemd/user'; units.mkdir(parents=True,exist_ok=True)
    (units/'tolley-inventory-assistant.service').write_text(f'''[Unit]
Description=Tolley Inventory Assistant V2 (starts paused)
After=network-online.target tolley-whatnot-bot.service
[Service]
Type=simple
WorkingDirectory={root}
ExecStart=/usr/bin/node {root}/server.mjs
Restart=on-failure
RestartSec=5
UMask=0077
[Install]
WantedBy=default.target
''')
    (units/'tolley-inventory-catalog.service').write_text(f'''[Unit]
Description=Read-only catalog snapshot for Tolley Inventory Assistant
[Service]
Type=oneshot
WorkingDirectory={root}
Environment=ASSISTANT_REPO_PACKAGE={HERE.parents[2]}/package.json
ExecStart=/usr/bin/node --env-file={HOME}/.config/tolley-security/production.env {root}/catalog-export.mjs
TimeoutStartSec=45
UMask=0077
''')
    (units/'tolley-inventory-catalog.timer').write_text('''[Unit]
Description=Refresh assistant inventory every minute
[Timer]
OnBootSec=30
OnUnitActiveSec=60
AccuracySec=5
[Install]
WantedBy=timers.target
''')
    director=HOME/'stream-director'; target=director/'whatnot_bot_routes.py'
    backup=director/f'whatnot-bot-routes-backup-{int(time.time())}.py'
    shutil.copy2(target,backup); shutil.copy2(HERE/'director_routes.py',target)
    for command in [['daemon-reload'],['start','tolley-inventory-catalog.service'],['enable','--now','tolley-inventory-catalog.timer','tolley-inventory-assistant.service']]:
        subprocess.run(['systemctl','--user',*command],check=True)
    # Recheck immediately before the sole director restart.
    s=module.status()
    if s['armed'] or s['obs']['streaming'] or any(d.get('running') for d in s['destinations'].values()):
        shutil.copy2(backup,target)
        raise SystemExit('House became active; route installation deferred, V2 remains paused.')
    subprocess.run(['systemctl','--user','restart','stream-director.service'],check=True)
    print('V2 installed paused; catalog timer enabled. Classic service was not restarted. Backup:',backup.name)
if __name__=='__main__': main()
