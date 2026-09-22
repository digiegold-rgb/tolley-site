"""Source-bound automatic recording and timestamped platform observations."""
import hashlib
import json
import uuid
from source_metadata import source_id, YOUTUBE_CHANNEL

PLATFORMS={'yt':'youtube','tt':'tiktok'}

def initialize(c):
    cols={r['name'] for r in c.execute('PRAGMA table_info(sessions)')}
    if 'automatic' not in cols:c.execute('ALTER TABLE sessions ADD COLUMN automatic INTEGER NOT NULL DEFAULT 0')
    if 'idle_since' not in cols:c.execute('ALTER TABLE sessions ADD COLUMN idle_since REAL')
    c.executescript('''
      CREATE TABLE IF NOT EXISTS automation (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL);
      INSERT OR IGNORE INTO automation VALUES(1,1);
      CREATE TABLE IF NOT EXISTS suppressed_sources (source TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS viewer_samples (id TEXT PRIMARY KEY,session_id TEXT NOT NULL,platform TEXT NOT NULL,source TEXT NOT NULL,t REAL NOT NULL,viewers INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS viewers_session ON viewer_samples(session_id,platform,t);
      CREATE TABLE IF NOT EXISTS profile_samples (id TEXT PRIMARY KEY,platform TEXT NOT NULL,handle TEXT NOT NULL,t REAL NOT NULL,followers INTEGER,sold INTEGER);
    ''')

def confirmed(p,m,now):
    return (m.get('verified') is True and m.get('liveNow') is True and bool(source_id(p,m))
            and now-90 <= m.get('checkedAt',0) <= now+5
            and (p!='yt' or m.get('channelId')==YOUTUBE_CHANNEL))

def observe(c,payload,now):
    enabled=bool(c.execute('SELECT enabled FROM automation WHERE id=1').fetchone()[0])
    live={p:m for p,k in PLATFORMS.items() if confirmed(p,(m:=payload.get(k) or {}),now)}
    blocked={r[0] for r in c.execute('SELECT source FROM suppressed_sources')}
    live={p:m for p,m in live.items() if source_id(p,m) not in blocked}
    active=c.execute('SELECT * FROM sessions WHERE ended IS NULL').fetchone()
    if active and active['automatic'] and enabled:
        bound=json.loads(active['sources'])
        # Only confirmed offline/source replacement ends automatic capture. Network
        # failures remain unknown, and never manufacture an ended broadcast.
        ended=bool(bound) and set(bound)<=set(PLATFORMS) and all(
            ((m:=payload.get(PLATFORMS[p]) or {}).get('verified') is True
             and now-90<=m.get('checkedAt',0)<=now+5
             and (m.get('liveNow') is False or (m.get('liveNow') is True and source_id(p,m)!=s)))
            for p,s in bound.items() if p in PLATFORMS)
        if ended:
            since=active['idle_since'] or now
            c.execute('UPDATE sessions SET idle_since=? WHERE id=?',(since,active['id']))
            if now-since>=180:
                c.execute('UPDATE sessions SET ended=? WHERE id=?',(now,active['id']))
                active=None
        else:c.execute('UPDATE sessions SET idle_since=NULL WHERE id=?',(active['id'],))
    if not active and live and enabled:
        sid=str(uuid.uuid4())
        meta=next(iter(live.values()))
        title=str(meta.get('title') or 'Live show')[:120]
        sources={p:source_id(p,m) for p,m in live.items()}
        buffered=[m['t'] for m in payload.get('items',[]) if isinstance(m.get('t'),(int,float)) and now-120<=m['t']<=now and m.get('source') in sources.values()]
        began=min([now,*buffered])
        c.execute('INSERT INTO sessions(id,title,started,sources,automatic) VALUES(?,?,?,?,1)',(sid,title,began,json.dumps(sources)))
        active=c.execute('SELECT * FROM sessions WHERE id=?',(sid,)).fetchone()
    if not active:return
    bound=json.loads(active['sources'])
    for p,m in live.items():
        if p not in bound:bound[p]=source_id(p,m)
    c.execute('UPDATE sessions SET sources=? WHERE id=?',(json.dumps(bound),active['id']))
    for p,k in PLATFORMS.items():
        m=payload.get(k) or {}
        t=m.get('viewersAt');v=m.get('viewers');source=source_id(p,m)
        if not confirmed(p,m,now) or bound.get(p)!=source or type(v) is not int or v<0 or not isinstance(t,(int,float)) or not active['started']<=t<=now+5 or now-t>90:continue
        eid=hashlib.sha256(f'{active["id"]}:{p}:{source}:{t}'.encode()).hexdigest()
        c.execute('INSERT OR IGNORE INTO viewer_samples VALUES(?,?,?,?,?,?)',(eid,active['id'],p,source,t,v))

def suppress(c,sid):
    r=c.execute('SELECT sources FROM sessions WHERE id=?',(sid,)).fetchone()
    if r:
        for source in json.loads(r[0]).values():c.execute('INSERT OR IGNORE INTO suppressed_sources VALUES(?)',(source,))

def dashboard(c,sid=None):
    out={'enabled':bool(c.execute('SELECT enabled FROM automation WHERE id=1').fetchone()[0]),'viewers':[],'profileHistory':[]}
    if sid:
        out['viewers']=[dict(r) for r in c.execute('SELECT platform, MAX(viewers) peak, COUNT(*) samples, MIN(t) firstAt, MAX(t) lastAt FROM viewer_samples WHERE session_id=? GROUP BY platform',(sid,))]
        for row in out['viewers']:
            latest=c.execute('SELECT t,viewers FROM viewer_samples WHERE session_id=? AND platform=? ORDER BY t DESC LIMIT 1',(sid,row['platform'])).fetchone()
            row['latest']=latest['viewers']
            row['series']=[dict(r) for r in c.execute('SELECT CAST(t/60 AS INTEGER)*60 t,MAX(viewers) viewers FROM viewer_samples WHERE session_id=? AND platform=? GROUP BY CAST(t/60 AS INTEGER) ORDER BY t DESC LIMIT 180',(sid,row['platform']))][::-1]
    out['profileHistory']=[dict(r) for r in c.execute('SELECT * FROM profile_samples ORDER BY t DESC LIMIT 48')]
    return out

def profile(c,record,now):
    # A public lifetime sold count is never a show sale or a revenue figure.
    p=record.get('profile') or {}
    if p.get('handle')!='treasure_hauls' or record.get('publicStatus')!='connected':return
    t=p.get('observedAt')
    if not isinstance(t,(int,float)) or not now-600<=t<=now+5:return
    followers=p.get('followers');sold=p.get('sold')
    if any(v is not None and (type(v) is not int or v<0) for v in (followers,sold)):return
    eid=f'whatnot:{int(t)//300}'
    c.execute('INSERT OR IGNORE INTO profile_samples VALUES(?,?,?,?,?,?)',(eid,'whatnot','treasure_hauls',t,followers,sold))
