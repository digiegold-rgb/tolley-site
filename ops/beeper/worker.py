#!/usr/bin/env python3
import argparse,datetime as dt,fcntl,json,os,pathlib,re,sqlite3,subprocess,time,unicodedata
from zoneinfo import ZoneInfo
BASE=pathlib.Path(__file__).resolve().parent
ROOT=pathlib.Path.home()/'.config/tolley-beeper-automation'
ACCOUNT='facebookgo.534686507'
ETA='Send me an ETA when you’re on your way'
def normalize(s):
 s=unicodedata.normalize('NFKC',s).lower().replace('’',"'")
 return re.sub(r'\s+',' ',s).strip()
def intent(s):
 s=normalize(s)
 if re.search(r"\b(not interested|not available|no longer|no thanks|never mind|nevermind|sold|scam|stop|don't want|do not want|won't|cant|can't|cannot)\b",s):return None
 if re.search(r'\b(price|discount|condition|broken|damage|dimensions|measure|size|deliver|delivery|work|working|take \$|accept \$|if|unless|would you take|would you accept|best price|where|address)\b',s) or '$' in s:return None
 if re.search(r'\b(is (?:this|it|that)(?: item)? (?:still )?available|still available|available\??$|do you still have (?:this|it|that))\b',s):return 'available'
 if re.search(r"\b(interested|i'?ll take (?:it|this|that)|i will take (?:it|this|that)|sounds good|i want (?:it|this|that)|i would like (?:it|this|that)|(?:can|could|may) i (?:come|pick)|i can (?:come|pick)|pick (?:it |this |that )?up|on my way)\b",s):return 'positive'
 if re.fullmatch(r'(yes|yeah|yep|ok|okay|sure|great|perfect|absolutely)[!. ]*',s):return 'positive'
 return None
def first(now):
 d=dt.datetime.fromtimestamp(now,ZoneInfo('America/Chicago'))
 return 'Yes, it is. Would you like to pick it up '+('today' if d.hour<19 else 'tomorrow')+'?\nI am available until 7 PM'
def stamp(s):return dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def eligible(c):
 p=c.get('participants',{});items=p.get('items',[])
 return c.get('accountID')==ACCOUNT and ' · ' in c.get('title','') and p.get('total')==2 and not p.get('hasMore') and sum(bool(x.get('isSelf')) for x in items)==1 and not any(x.get('isNetworkBot') for x in items) and not c.get('isReadOnly') and not c.get('merge')
def transport(**x):
 p=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=8','mac-mini','python3 .local/share/tolley-beeper/remote.py'],input=json.dumps(x),text=True,capture_output=True,timeout=40)
 if p.returncode:raise RuntimeError('Beeper transport failed (details withheld; check mini connectivity)')
 return json.loads(p.stdout)
def db():
 os.umask(0o077);ROOT.mkdir(parents=True,exist_ok=True)
 c=sqlite3.connect(ROOT/'state.sqlite');c.row_factory=sqlite3.Row
 c.executescript('''CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY,v TEXT);
 CREATE TABLE IF NOT EXISTS chats(id TEXT PRIMARY KEY,title TEXT,stage INTEGER DEFAULT 0,paused INTEGER DEFAULT 0,reason TEXT);
 CREATE TABLE IF NOT EXISTS seen(chat TEXT,id TEXT,PRIMARY KEY(chat,id));
 CREATE TABLE IF NOT EXISTS sends(chat TEXT,step INTEGER,text TEXT,started REAL,status TEXT,message_id TEXT,PRIMARY KEY(chat,step));
 CREATE TABLE IF NOT EXISTS listings(title TEXT PRIMARY KEY,paused INTEGER);
 CREATE TABLE IF NOT EXISTS events(at REAL,chat TEXT,kind TEXT);''');return c
def setting(c,k,default=None):
 r=c.execute('SELECT v FROM settings WHERE k=?',(k,)).fetchone();return r[0] if r else default
def put(c,k,v):c.execute('INSERT OR REPLACE INTO settings VALUES(?,?)',(k,str(v)));c.commit()
def event(c,chat,kind):c.execute('INSERT INTO events VALUES(?,?,?)',(time.time(),chat,kind));c.commit()
def pause(c,chat,reason):c.execute('UPDATE chats SET paused=1,reason=? WHERE id=?',(reason,chat));event(c,chat,reason)
def allchats():
 out=[];cursor=None;used=set()
 for _ in range(100):
  d=transport(op='chats',cursor=cursor);out.extend(d['items'])
  if not d.get('hasMore'):return out
  cursor=d.get('oldestCursor')
  if not cursor or cursor in used:raise RuntimeError('Chat pagination incomplete')
  used.add(cursor)
 raise RuntimeError('Chat pagination limit')
def messages(cid,since):
 out=[];cursor=None;used=set()
 for _ in range(100):
  d=transport(op='messages',chat=cid,cursor=cursor);batch=d['items'];out.extend(batch)
  if not d.get('hasMore') or (batch and min(stamp(m['timestamp']) for m in batch)<since):return sorted(out,key=lambda m:(stamp(m['timestamp']),m.get('sortKey','')))
  cursor=d.get('oldestCursor')
  if not cursor or cursor in used:raise RuntimeError('Message pagination incomplete')
  used.add(cursor)
 raise RuntimeError('Message pagination limit')
def process(c,chat,ms,now,live=True):
 cid=chat['id'];activation=float(setting(c,'activated','inf'))
 c.execute('INSERT INTO chats(id,title) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title',(cid,chat['title']));c.commit()
 row=c.execute('SELECT * FROM chats WHERE id=?',(cid,)).fetchone()
 # A seller-side buyer question must not enroll Ruthann's purchasing conversations.
 if any(m.get('isSender') is True and intent(m.get('text',''))=='available' for m in ms):
  pause(c,cid,'buyer-side-conversation');return
 listing=chat['title'].split(' · ',1)[1]
 blocked=c.execute('SELECT paused FROM listings WHERE title=?',(listing,)).fetchone()
 if row['paused'] or (blocked and blocked[0]):return
 sends=list(c.execute('SELECT * FROM sends WHERE chat=?',(cid,)))
 for s in sends:
  if s['status']!='sent':
   matches=[m for m in ms if m.get('isSender') is True and m.get('text')==s['text'] and stamp(m['timestamp'])>=s['started']-5]
   if matches:
    m=matches[-1];status=(m.get('sendStatus') or {}).get('status','SUCCESS')
    if status.startswith('FAIL'):
     pause(c,cid,'delivery-failed');return
    if status=='PENDING':return
    c.execute('UPDATE sends SET status="sent",message_id=? WHERE chat=? AND step=?',(m['id'],cid,s['step']));c.execute('UPDATE chats SET stage=? WHERE id=?',(s['step'],cid));c.commit()
   elif now-s['started']<60:return
   else:pause(c,cid,'uncertain-send');return
 fresh=[m for m in ms if stamp(m['timestamp'])>=activation and not c.execute('SELECT 1 FROM seen WHERE chat=? AND id=?',(cid,m['id'])).fetchone()]
 if not fresh:return
 for m in fresh:c.execute('INSERT OR IGNORE INTO seen VALUES(?,?)',(cid,m['id']))
 c.commit()
 sends=list(c.execute('SELECT * FROM sends WHERE chat=?',(cid,)))
 for m in fresh:
  if m.get('isSender') is True and not any(m['id']==s['message_id'] or (m.get('text')==s['text'] and abs(stamp(m['timestamp'])-s['started'])<120) for s in sends):pause(c,cid,'human-takeover');return
 incoming=[m for m in fresh if m.get('isSender') is False and m.get('type')=='TEXT' and not m.get('isDeleted') and not m.get('isHidden')]
 if not incoming:return
 if now-stamp(incoming[-1]['timestamp'])>3600:pause(c,cid,'stale-message');return
 stage=c.execute('SELECT stage FROM chats WHERE id=?',(cid,)).fetchone()[0]
 if stage>=2:return
 text=' '.join(m.get('text','') for m in incoming);kind=intent(text)
 if stage==0 and kind=='available':step=1;reply=first(now)
 elif stage==1 and kind=='positive':step=2;reply=ETA
 else:event(c,cid,'no-rule-match');return
 if not live:event(c,cid,'preview-step-'+str(step));return
 # Recheck globally and conversation state, then fresh server view immediately before send.
 if setting(c,'paused','1')=='1':return
 current=c.execute('SELECT paused FROM chats WHERE id=?',(cid,)).fetchone()
 blocked=c.execute('SELECT paused FROM listings WHERE title=?',(listing,)).fetchone()
 if current[0] or (blocked and blocked[0]):return
 latest=messages(cid,stamp(incoming[0]['timestamp'])-5)
 if any(stamp(m['timestamp'])>=activation and not c.execute('SELECT 1 FROM seen WHERE chat=? AND id=?',(cid,m['id'])).fetchone() for m in latest):
  # Defer without losing this trigger; next cycle considers the complete new batch.
  for m in incoming:c.execute('DELETE FROM seen WHERE chat=? AND id=?',(cid,m['id']))
  c.commit();return
 c.execute('INSERT INTO sends VALUES(?,?,?,?,?,NULL)',(cid,step,reply,now,'pending'));c.commit()
 try:
  result=transport(op='send',chat=cid,text=reply)
  mid=result.get('pendingMessageID') or result.get('messageID')
  c.execute('UPDATE sends SET status="accepted",message_id=? WHERE chat=? AND step=?',(mid,cid,step));c.execute('UPDATE chats SET stage=? WHERE id=?',(step,cid));event(c,cid,'sent-step-'+str(step))
 except Exception:pause(c,cid,'uncertain-send')
def cycle(c):
 if setting(c,'paused','1')=='1':return
 activation=float(setting(c,'activated','inf'));chats=allchats()
 for chat in chats:
  if not eligible(chat):continue
  if stamp(chat.get('lastActivity','1970-01-01T00:00:00Z'))<activation:continue
  row=c.execute('SELECT stage,paused FROM chats WHERE id=?',(chat['id'],)).fetchone()
  if row and row['paused']:continue
  if row and row['stage']>=2 and not c.execute('SELECT 1 FROM sends WHERE chat=? AND status!="sent"',(chat['id'],)).fetchone():continue
  process(c,chat,messages(chat['id'],activation),time.time())
 put(c,'last_success',time.time());put(c,'error','')
def main():
 p=argparse.ArgumentParser();p.add_argument('command',choices=['run','preview','status','activate','pause','resume','listing-pause','listing-resume','reset']);p.add_argument('target',nargs='?');a=p.parse_args();c=db()
 if a.command=='preview':
  cs=allchats();es=[x for x in cs if eligible(x)];print(json.dumps({'account':ACCOUNT,'total_chats':len(cs),'eligible_marketplace_chats':len(es),'eligible_titles':[x['title'] for x in es[:15]],'sends':0},indent=2));return
 if a.command=='status':
  print(json.dumps({'settings':dict(c.execute('SELECT k,v FROM settings')),'chats':[dict(r) for r in c.execute('SELECT * FROM chats')],'sends':dict(c.execute('SELECT status,count(*) FROM sends GROUP BY status'))},indent=2));return
 if a.command=='activate':
  if setting(c,'activated') is None:put(c,'activated',time.time())
  put(c,'paused','0');print('Enabled for messages after activation timestamp.');return
 if a.command in ('pause','resume'):
  value=int(a.command=='pause')
  if a.target:c.execute('UPDATE chats SET paused=?,reason=? WHERE id=?',(value,'operator' if value else None,a.target));c.commit()
  else:put(c,'paused',value)
  return
 if a.command.startswith('listing-'):
  if not a.target:p.error('Exact listing title required (without buyer prefix)')
  c.execute('INSERT OR REPLACE INTO listings VALUES(?,?)',(a.target,int(a.command=='listing-pause')));c.commit();return
 if a.command=='reset':
  if not a.target:p.error('Conversation ID required')
  c.execute('DELETE FROM sends WHERE chat=?',(a.target,));c.execute('UPDATE chats SET stage=0,paused=0,reason=NULL WHERE id=?',(a.target,));c.commit();return
 with open(ROOT/'worker.lock','w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  while True:
   try:
    import hq
    hq.tick(c)
    cycle(c)
   except Exception as e:put(c,'error',type(e).__name__+': '+str(e));print('Cycle failed:',type(e).__name__,flush=True)
   time.sleep(15)
if __name__=='__main__':main()
