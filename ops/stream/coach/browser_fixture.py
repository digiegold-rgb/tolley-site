"""Disposable local fixture; never installs into the director."""
import time
import tempfile
from pathlib import Path
import service
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn

root=Path(tempfile.mkdtemp(prefix='tolley-coach-browser-'))
service.DB_PATH=root/'coach.sqlite3'
service.initialize()
sid=service.action({'action':'start','title':'Saturday treasure haul · test fixture'})['id']
with service.db() as c:c.execute('UPDATE sessions SET started=? WHERE id=?',(time.time()-600,sid))
service.POLL.update(at=time.time(),youtube={'connected':True,'video':'test-source'},tiktok={'connected':False})
service.ingest({'youtube':{'connected':True,'video':'test-source'},'items':[
 {'id':1,'t':time.time()-20,'p':'yt','u':'Sam','m':'Does the hair dryer work on 220v?','k':'chat'},
 {'id':2,'t':time.time()-17,'p':'yt','u':'Jess','m':'Can you combine shipping?','k':'chat'},
 {'id':3,'t':time.time()-10,'p':'yt','u':'Alex','m':'I want the blue one!','k':'chat'},
 {'id':4,'t':time.time()-8,'p':'yt','u':'Sam','m':'Great show tonight!','k':'chat'}]})
service.action({'action':'sale','id':'fixture-sale','sessionId':sid,'platform':'whatnot','item':'Kitchen gadget bundle','buyer':'happybuyer','cents':1800,'quantity':2})
app=FastAPI()
@app.middleware('http')
async def guard(request:Request,call_next):
 if request.headers.get('x-api-key')!='coach-test-only':return JSONResponse({'error':'unauthorized'},status_code=401)
 service.POLL['at']=time.time()
 return await call_next(request)
app.mount('/coach',service.app)
uvicorn.run(app,host='127.0.0.1',port=8095,log_level='warning')
