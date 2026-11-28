"""Owner HQ bridge. Called inside the sole sending worker; commands are durable/idempotent."""
import datetime as dt,json,os,time,urllib.request,uuid
import worker as w

def api(payload=None):
 secret=os.environ.get('CUSTOMER_SYNC_SECRET')
 if not secret:raise RuntimeError('HQ sync credential is not configured')
 url=os.environ.get('CUSTOMER_SYNC_URL','https://www.tolley.io').rstrip('/')+'/api/hq/beeper/sync'
 req=urllib.request.Request(url,data=json.dumps(payload).encode() if payload is not None else None,headers={'Authorization':'Bearer '+secret,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=20) as response:return json.load(response)

def execute(c,cmd):
 ident=str(uuid.UUID(cmd['id']));action=cmd['action'];cid=cmd.get('chatId')
 old=c.execute('SELECT status,detail FROM commands WHERE id=?',(ident,)).fetchone()
 if old:
  return {'type':'ack','id':ident,'status':old[0] if old[0]!='inflight' else 'uncertain','detail':old[1] or 'Interrupted send; check Messenger before retrying.'}
 status='done';detail='Applied'
 if action not in ('pause','resume','listing-pause','listing-resume','send'):status='error';detail='Unknown action'
 elif action=='send' and time.time()-w.stamp(cmd['createdAt'])>900:status='error';detail='Reply expired; review the latest conversation and send again.'
 else:
  if action=='send':
   if not cid or not isinstance(cmd.get('text'),str) or not 1<=len(cmd['text'].strip())<=4000 or not cmd.get('expectedMessageId'):status='error';detail='Invalid reply'
   else:
    c.execute('UPDATE chats SET paused=1,reason="owner-reply" WHERE id=?',(cid,))
    c.execute('INSERT INTO commands VALUES(?,?,?)',(ident,'inflight',''));c.commit()
    try:
     result=w.transport(op='manual-send',chat=cid,text=cmd['text'],expectedMessageId=cmd['expectedMessageId'])
     if result.get('error'):status='error';detail=result['error']
     else:detail='Beeper accepted the reply. Conversation automation is paused.'
    except Exception:status='uncertain';detail='Delivery uncertain; check Messenger before sending again.'
  elif action.startswith('listing-'):
   title=cmd.get('listing')
   if not title:status='error';detail='Missing item title'
   else:c.execute('INSERT OR REPLACE INTO listings VALUES(?,?)',(title,int(action=='listing-pause')))
  elif cid:
   if not c.execute('SELECT 1 FROM chats WHERE id=?',(cid,)).fetchone():status='error';detail='Conversation not synced yet'
   else:c.execute('UPDATE chats SET paused=?,reason=? WHERE id=?',(int(action=='pause'),'operator' if action=='pause' else None,cid))
  else:w.put(c,'paused',int(action=='pause'))
 c.execute('INSERT OR REPLACE INTO commands VALUES(?,?,?)',(ident,status,detail));c.commit()
 return {'type':'ack','id':ident,'status':status,'detail':detail}

def snapshot(c):
 chats=[]
 for chat in w.allchats():
  if not w.eligible(chat):continue
  cid=chat['id'];listing=chat['title'].split(' · ',1)[1]
  result=w.transport(op='messages',chat=cid)
  ms=sorted(result['items'],key=lambda m:(w.stamp(m['timestamp']),m.get('sortKey','')))[-100:]
  c.execute('INSERT INTO chats(id,title) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title',(cid,chat['title']));c.commit()
  row=c.execute('SELECT * FROM chats WHERE id=?',(cid,)).fetchone()
  item=c.execute('SELECT paused FROM listings WHERE title=?',(listing,)).fetchone()
  paused=bool(row['paused'] or (item and item[0]))
  visible=[m for m in ms if not m.get('isDeleted') and not m.get('isHidden')]
  last=visible[-1] if visible else {}
  reason='item-paused' if item and item[0] else row['reason']
  review=(last.get('isSender') is False) or reason in ('uncertain-send','delivery-failed','stale-message')
  chats.append({'id':cid,'accountID':w.ACCOUNT,'title':chat['title'][:300],'listing':listing[:300],'stage':row['stage'],'paused':paused,'reason':reason,'lastActivity':chat.get('lastActivity') or dt.datetime.now(dt.timezone.utc).isoformat(),'needsReview':bool(review),'hasMore':bool(result.get('hasMore')),'messages':[{'id':m['id'],'text':'' if m.get('isDeleted') or m.get('isHidden') else m.get('text','')[:10000],'at':m['timestamp'],'outgoing':m.get('isSender') is True,'deleted':bool(m.get('isDeleted') or m.get('isHidden')),'type':m.get('type','TEXT')} for m in ms]})
 if len(chats)>200:raise RuntimeError('Inbox exceeds 200-conversation sync limit; expand before continuing')
 return {'type':'snapshot','paused':w.setting(c,'paused','1')=='1','healthy':not bool(w.setting(c,'error','')),'error':w.setting(c,'error','')[:300],'chats':chats}

def tick(c):
 if not os.environ.get('CUSTOMER_SYNC_SECRET'):return
 c.execute('CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,status TEXT,detail TEXT)');c.commit()
 try:
  for cmd in api()['commands']:api(execute(c,cmd))
  if time.time()-float(w.setting(c,'hq_last_sync','0'))>=30:
   snap=snapshot(c);batch=[];size=0
   for chat in snap['chats']:
    n=len(json.dumps(chat).encode())
    if batch and size+n>1800000:api({**snap,'chats':batch});batch=[];size=0
    batch.append(chat);size+=n
   api({**snap,'chats':batch});w.put(c,'hq_last_sync',time.time())
  w.put(c,'hq_error','')
 except Exception as exc:
  w.put(c,'hq_error',type(exc).__name__+': HQ synchronization failed')
