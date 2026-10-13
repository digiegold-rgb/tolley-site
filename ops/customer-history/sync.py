"""Spark worker: selected Apple threads -> owner HQ. No send capability.
Secrets are supplied via protected environment file, never command arguments.
"""
import base64, datetime, json, os, subprocess, sys, time, urllib.request
from pathlib import Path
import typedstream
from typedstream.archiving import TypedValue
from typedstream.types.foundation import NSString
ROOT=Path(__file__).resolve().parent
BASE=os.environ.get('CUSTOMER_SYNC_URL','https://www.tolley.io').rstrip('/')
SECRET=os.environ['CUSTOMER_SYNC_SECRET']
def api(path, payload=None, raw=None, headers=None):
    h={'Authorization':'Bearer '+SECRET,**(headers or {})}
    data=raw
    if payload is not None: h['Content-Type']='application/json';data=json.dumps(payload).encode()
    req=urllib.request.Request(BASE+path,data=data,headers=h)
    with urllib.request.urlopen(req,timeout=60) as r: return json.load(r)
def mac(args):
    encoded=base64.b64encode(json.dumps(args).encode()).decode()
    result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','mac-mini','python3 - '+encoded],input=(ROOT/'mac-read.py').read_bytes(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=90)
    if result.returncode: raise RuntimeError('Mac read failed: '+result.stderr.decode(errors='replace')[-300:])
    return result.stdout
def decode(blob):
    if not blob: return None
    data=base64.b64decode(blob,validate=True)
    if len(data)>2000000: raise ValueError('Message archive too large')
    value=typedstream.unarchive_from_data(data)
    if isinstance(value,NSString): return value.value
    clazz=getattr(value,'clazz',None)
    if not clazz or clazz.name not in (b'NSAttributedString',b'NSMutableAttributedString'): raise ValueError('Unsupported message archive')
    for item in value.contents:
        child=item.value if isinstance(item,TypedValue) else item
        if isinstance(child,NSString): return child.value
    raise ValueError('No string in message archive')
def post_events(thread_id,rows):
    result=[];batch=[];size=0
    for row in rows:
        if isinstance(row.get('body'),str): row['body']=row['body'][:50000]
        length=len(json.dumps(row).encode())
        if batch and (size+length>1400000 or len(batch)>=100):
            result.extend(api('/api/hq/customer-sync',{'type':'events','threadId':thread_id,'events':batch})['saved']);batch=[];size=0
        batch.append(row);size+=length
    if batch: result.extend(api('/api/hq/customer-sync',{'type':'events','threadId':thread_id,'events':batch})['saved'])
    return {'saved':result}
def run():
    cfg=api('/api/hq/customer-sync'); candidates=json.loads(mac({'mode':'candidates'}))
    api('/api/hq/customer-sync',{'type':'candidates',**candidates})
    counts={'threads':0,'messages':0,'photos':0,'decodeErrors':0,'pendingAttachments':0}
    today=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    for thread in cfg['threads']:
        saved=json.loads(thread['checkpoint'] or '{}')
        # Daily full reconciliation catches old edits, retractions and late downloads.
        sweep=saved.get('sweep')!=today
        after=0 if sweep else int(saved.get('after',0))
        pages=0;scan=0;baseAfter=after
        while True:
            data=json.loads(mac({'mode':'events','threadId':thread['id'],'phone':thread['phone'],'after':baseAfter,'scan':scan}))
            rows=data['events']; attachments={}
            for e in rows:
                archive=e.pop('attributed',None)
                if e['body'] is None and archive and not e['retracted']:
                    try: e['body']=decode(archive)
                    except Exception: e['decodeError']=True;counts['decodeErrors']+=1
                files=e.pop('attachments',[])
                if e['retracted']: e['body']=None
                attachments[e['guid']]=[] if e['retracted'] else files
            result=post_events(thread['id'],rows)
            for event in result['saved']:
                for a in attachments.get(event['sourceKey'],[]):
                    source='apple:'+thread['id']+':'+a['guid']
                    if source in event['attachments']: continue
                    if not a['downloaded'] or a['size']>4000000 or a['mime'] not in ['image/jpeg','image/png','image/heic','image/heif','application/pdf']:
                        counts['pendingAttachments']+=1;continue
                    content=mac({'mode':'attachment','threadId':thread['id'],'phone':thread['phone'],'guid':a['guid']})
                    hdr={'x-thread-id':thread['id'],'x-event-id':event['id'],'x-attachment-id':a['guid'],'x-file-name':a['name'].encode('ascii','replace').decode(),'Content-Type':a['mime']}
                    api('/api/hq/customer-sync/attachment',raw=content,headers=hdr)
                    if a['mime'] in ['image/heic','image/heif']:
                        preview=mac({'mode':'attachment','threadId':thread['id'],'phone':thread['phone'],'guid':a['guid'],'preview':True})
                        api('/api/hq/customer-sync/attachment',raw=preview,headers={**hdr,'Content-Type':'image/jpeg','x-preview':'1'})
                    counts['photos']+=1
            counts['messages']+=len(rows);after=max(after,data['after']);scan=data['scan'];pages+=1
            if not data['hasMore']: break
            if pages>=100: raise RuntimeError('Backfill exceeded batch allowance; retry needed')
        for offset in range(0,len(data['calls']),100):
            api('/api/hq/customer-sync',{'type':'events','threadId':thread['id'],'events':data['calls'][offset:offset+100]})
        api('/api/hq/customer-sync',{'type':'events','threadId':thread['id'],'events':[],'checkpoint':json.dumps({'after':after,'sweep':today})})
        counts['threads']+=1
    ok=counts['decodeErrors']==0 and counts['pendingAttachments']==0
    api('/api/hq/customer-sync',{'type':'status','ok':ok,'error':None if ok else 'Some messages or attachments need review on the Mac','meta':counts})
    print(json.dumps({'ok':ok,**counts}))
if __name__=='__main__':
    try: run()
    except Exception as e:
        # Keep identifiers, content and credentials out of service logs.
        message=type(e).__name__+': phone sync incomplete; retained last checkpoint'
        try: api('/api/hq/customer-sync',{'type':'status','ok':False,'error':message})
        except Exception: pass
        print(message,file=sys.stderr);sys.exit(1)
