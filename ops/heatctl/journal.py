"""Durable event log, JSONL export and acknowledged outbox. SQLite is authoritative."""
import json
import os
import sqlite3
import time
import urllib.request
import uuid
from pathlib import Path
from common import ROOT, stamp, atomic


class Journal:
    def __init__(self,root=ROOT):
        self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(self.root/"events.sqlite",timeout=20,check_same_thread=False)
        self.db.execute("PRAGMA journal_mode=WAL");self.db.execute("PRAGMA synchronous=FULL")
        self.db.executescript('''CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,ts REAL NOT NULL,payload TEXT NOT NULL,delivered INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);
          CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,result TEXT NOT NULL);''')

    def emit(self,event,now=None):
        now=time.time() if now is None else now
        e={"id":str(uuid.uuid4()),"ts":stamp(now),**event}
        text=json.dumps(e,allow_nan=False,separators=(",",":"))
        with self.db:self.db.execute("INSERT OR IGNORE INTO events(id,ts,payload) VALUES(?,?,?)",(e["id"],now,text))
        self.export()
        return e

    def export(self):
        cur=self.db.execute("SELECT value FROM meta WHERE key='export_seq'").fetchone()
        rows=self.db.execute("SELECT seq,payload FROM events WHERE seq>? ORDER BY seq",(int(cur[0]) if cur else 0,)).fetchall()
        if not rows:return
        # Rotate by calendar date. A crash before cursor commit can duplicate IDs, never lose events.
        grouped={}
        for seq,text in rows:
            date=json.loads(text)["ts"][:10];grouped.setdefault(date,[]).append(text)
        for date,texts in grouped.items():
            path=self.root/"logs"/(date+".jsonl");path.parent.mkdir(exist_ok=True)
            with path.open("a") as f:
                f.write("\n".join(texts)+"\n");f.flush();os.fsync(f.fileno())
        with self.db:self.db.execute("INSERT OR REPLACE INTO meta VALUES('export_seq',?)",(str(rows[-1][0]),))

    def send(self,cfg):
        rows=self.db.execute("SELECT id,payload FROM events WHERE delivered=0 ORDER BY seq LIMIT 100").fetchall()
        if not cfg.get("upload_enabled") or not rows:return
        token=(Path.home()/"heatpush/token").read_text().strip()
        req=urllib.request.Request(cfg["upload_url"],data=json.dumps({"events":[json.loads(r[1]) for r in rows]}).encode(),
            headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req,timeout=20) as r:answer=json.load(r)
            ack=set(answer.get("event_ids",[]))
            if not answer.get("ok") or not set(r[0] for r in rows).issubset(ack):raise RuntimeError("Event acknowledgement missing")
            with self.db:self.db.executemany("UPDATE events SET delivered=1 WHERE id=?",[(r[0],) for r in rows])
            atomic(self.root/"upload-status.json",{"ok":True,"ts":stamp(time.time()),"last_count":len(rows),"pending":self.pending()})
        except Exception as exc:
            atomic(self.root/"upload-status.json",{"ok":False,"ts":stamp(time.time()),"error":type(exc).__name__,"pending":self.pending()})

    def pending(self):return self.db.execute("SELECT count(*) FROM events WHERE delivered=0").fetchone()[0]

    def prune(self,now):
        # Never prune an unacknowledged event. JSONL daily files remain the local archive.
        with self.db:self.db.execute("DELETE FROM events WHERE delivered=1 AND ts<?",(now-2*366*86400,))
