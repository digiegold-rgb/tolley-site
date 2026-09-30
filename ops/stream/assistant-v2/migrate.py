"""Retire the old sender, preserve settings/history, and start one paused assistant."""
from pathlib import Path
import json, sqlite3, subprocess, time, urllib.request, urllib.error

HOME=Path.home()

def check_workers():
    for port in (8111,8112):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/snapshot',timeout=4) as r: state=json.load(r)
        except urllib.error.URLError as e:
            if isinstance(e.reason,ConnectionRefusedError):continue
            raise RuntimeError('Cannot verify assistant state') from None
        if not state.get('paused') or state.get('busy'):
            raise RuntimeError('An assistant is active or busy; wait until it is paused before migration')

def migrate_config(legacy_path,current_path):
    old=sqlite3.connect(legacy_path);new=sqlite3.connect(current_path)
    try:
        new.execute('CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY,value TEXT NOT NULL)')
        if new.execute("SELECT 1 FROM config WHERE key='classic-migrated'").fetchone():return False
        for key in ('settings','facts-show'):
            row=old.execute('SELECT value FROM config WHERE key=?',(key,)).fetchone()
            if row:new.execute('INSERT OR REPLACE INTO config VALUES(?,?)',(key,row[0]))
        new.execute("INSERT OR REPLACE INTO config VALUES('classic-migrated',?)",(str(int(time.time())),));new.commit();return True
    finally:old.close();new.close()

def retire_classic():
    check_workers()
    subprocess.run(['systemctl','--user','stop','tolley-inventory-assistant.service'],check=True)
    subprocess.run(['systemctl','--user','disable','--now','tolley-whatnot-bot.service'],check=True)
    legacy=HOME/'.local/state/tolley-whatnot-bot/bot.sqlite3'
    current=HOME/'.local/state/tolley-inventory-assistant/bot.sqlite3'
    current.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    backup=current.parent/f'migration-backup-{int(time.time())}';backup.mkdir(mode=0o700)
    for name,path in [('classic',legacy),('inventory',current)]:
        if path.exists():
            with sqlite3.connect(path) as source,sqlite3.connect(backup/(name+'.sqlite3')) as target:source.backup(target)
            (backup/(name+'.sqlite3')).chmod(0o600)
    migrated=migrate_config(legacy,current);current.chmod(0o600)
    print('Previous sender retired; settings preserved; history and opt-outs retained. Settings migrated:',migrated)
