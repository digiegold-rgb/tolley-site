#!/usr/bin/env python3
"""Private transport: token stays on mini; restrict writes to Ruthann Marketplace."""
import json,pathlib,sys,urllib.request,urllib.parse
ACCOUNT='facebookgo.534686507'
t=json.loads((pathlib.Path.home()/'.config/tolley-beeper/token.json').read_text())
def api(path,data=None):
 r=urllib.request.Request('http://127.0.0.1:23373'+path,data=json.dumps(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+t['access_token'],'Content-Type':'application/json'})
 with urllib.request.urlopen(r,timeout=20) as f:return json.load(f)
def eligible(c):
 ps=c.get('participants',{})
 return c.get('accountID')==ACCOUNT and ' · ' in c.get('title','') and ps.get('total')==2 and not ps.get('hasMore') and sum(p.get('isSelf',False) for p in ps.get('items',[]))==1 and not any(p.get('isNetworkBot') for p in ps.get('items',[])) and not c.get('isReadOnly') and not c.get('merge')
x=json.load(sys.stdin);op=x['op']
if op=='chats':
 q={'accountIDs':ACCOUNT,'limit':200}
 if x.get('cursor'):q.update(cursor=x['cursor'],direction='before')
 print(json.dumps(api('/v1/chats?'+urllib.parse.urlencode(q))))
elif op in ('messages','send','manual-send'):
 cid=x['chat'];path='/v1/chats/'+urllib.parse.quote(cid,safe='');c=api(path)
 if not eligible(c):raise ValueError('Not an eligible Marketplace conversation')
 if op=='messages':
  q='?'+urllib.parse.urlencode({'cursor':x['cursor'],'direction':'before'}) if x.get('cursor') else ''
  print(json.dumps(api(path+'/messages'+q)))
 elif op=='manual-send':
  text=x.get('text','')
  latest=api(path+'/messages')['items']
  latest=sorted(latest,key=lambda m:(m['timestamp'],m.get('sortKey','')))
  if not isinstance(text,str) or not 1<=len(text.strip())<=4000:print(json.dumps({'error':'Invalid reply'}))
  elif not latest or latest[-1]['id']!=x.get('expectedMessageId'):print(json.dumps({'error':'Conversation changed. Refresh and review before sending.'}))
  else:print(json.dumps(api(path+'/messages',{'text':text})))
 else:
  from datetime import datetime
  from zoneinfo import ZoneInfo
  day=datetime.now(ZoneInfo('America/Chicago')).hour<19
  first='Yes, it is. Would you like to pick it up '+('today' if day else 'tomorrow')+'?\nI am available until 7 PM'
  allowed=[first,'Send me an ETA when you’re on your way']
  if x.get('text') not in allowed:raise ValueError('Unapproved reply template or cutoff changed')
  print(json.dumps(api(path+'/messages',{'text':x['text']})))
else:raise ValueError('Unsupported operation')
