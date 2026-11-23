"""Save owner feedback with the observed conditions; never change equipment."""
import fcntl,json,os,sys,time,uuid
from common import ROOT,load,stamp

def record(text):
    if not text.strip():raise ValueError("Feedback text is empty")
    state=load(ROOT/'state.json',{}) or {};event=state.get('last_decision',{})
    entry={'id':str(uuid.uuid4()),'recorded_at':stamp(time.time()),'text':text,
        'decision_at':event.get('ts'),'mode':state.get('mode'),'period':event.get('period'),
        'inputs':event.get('inputs',{}),'plan':event.get('plan',{}),
        'devices':event.get('devices',{}),'override':event.get('override',{})}
    ROOT.mkdir(parents=True,exist_ok=True)
    path=ROOT/'feedback.jsonl'
    with path.open('a') as f:
        os.chmod(path,0o600);fcntl.flock(f,fcntl.LOCK_EX)
        f.write(json.dumps(entry,allow_nan=False)+'\n');f.flush();os.fsync(f.fileno())
    return {'saved':True,'id':entry['id'],'recorded_at':entry['recorded_at'],'equipment_changed':False}

if __name__=='__main__':
    print(json.dumps(record(' '.join(sys.argv[1:]).removeprefix('-- '))))
