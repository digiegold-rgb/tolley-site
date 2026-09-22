import asyncio
import importlib.util
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from fastapi import FastAPI, HTTPException, Header
from fastapi.testclient import TestClient
import httpx

spec=importlib.util.spec_from_file_location('coach',Path(__file__).with_name('service.py'))
coach=importlib.util.module_from_spec(spec);spec.loader.exec_module(coach)
spec2=importlib.util.spec_from_file_location('proxy',Path(__file__).with_name('director_routes.py'))
proxy=importlib.util.module_from_spec(spec2);spec2.loader.exec_module(proxy)

class CoachTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        coach.DB_PATH=Path(self.temp.name)/'test.sqlite3'
        coach.WHATNOT_PATH=Path(self.temp.name)/'whatnot.json'
        coach.initialize()
        self.sid=coach.action({'action':'start','title':'Test auction'})['id']
        with coach.db() as c:
            c.execute('UPDATE sessions SET started=? WHERE id=?',(time.time()-180,self.sid))
    def tearDown(self):self.temp.cleanup()
    def feed(self,messages,video='show-one'):
        coach.ingest({'youtube':{'connected':True,'video':video},'items':messages})
    def message(self,i=1,**changes):
        return {'id':i,'t':int(time.time())-2,'p':'yt','u':'Buyer','m':'How much is shipping?','k':'chat',**changes}
    def sale(self,**changes):
        return coach.action({'action':'sale','id':'sale-one','sessionId':self.sid,'platform':'whatnot','item':'Dryer','buyer':'buyer','cents':1200,'quantity':2,**changes})
    def test_capture_persists_and_deduplicates(self):
        m=self.message();self.feed([m]);self.feed([m]);coach.initialize()
        self.assertEqual(coach.snapshot(self.sid)['metrics']['messages'],1)
    def test_only_active_session_captures(self):
        coach.action({'action':'end','sessionId':self.sid})
        self.feed([self.message()])
        self.assertEqual(coach.snapshot(self.sid)['metrics']['messages'],0)
    def test_old_or_future_buffer_is_excluded(self):
        self.feed([self.message(t=time.time()-300),self.message(2,t=time.time()+1000)])
        self.assertEqual(coach.snapshot(self.sid)['metrics']['messages'],0)
    def test_switched_account_not_attached(self):
        self.feed([self.message()]);self.feed([self.message(2)],video='competitor-show')
        self.assertEqual(coach.snapshot(self.sid)['metrics']['messages'],1)
    def test_unknown_source_not_captured(self):
        coach.ingest({'youtube':{'connected':False,'video':''},'items':[self.message()]})
        self.assertEqual(coach.snapshot(self.sid)['metrics']['messages'],0)
    def test_question_resolution_is_scoped(self):
        self.feed([self.message()]);q=coach.snapshot(self.sid)['questions'][0]
        coach.action({'action':'resolve','sessionId':self.sid,'id':q['id'],'resolved':True})
        self.assertEqual(coach.snapshot(self.sid)['metrics']['openQuestions'],0)
    def test_sales_idempotent_and_gifts_not_sales(self):
        self.feed([self.message(k='gift',amt='$100')]);self.sale();self.sale()
        s=coach.snapshot(self.sid)['metrics']
        self.assertEqual((s['salesCents'],s['orders'],s['units'],s['gifts']),(1200,1,2,1))
    def test_reused_sale_id_with_changed_amount_conflicts(self):
        self.sale()
        with self.assertRaises(HTTPException) as e:self.sale(cents=2400)
        self.assertEqual(e.exception.status_code,409)
    def test_invalid_sales_rejected(self):
        for changes in [{'cents':-1},{'cents':True},{'quantity':0},{'quantity':1.5},{'platform':'invalid'}]:
            with self.assertRaises(HTTPException):self.sale(**changes)
    def test_void_sale_retains_record(self):
        self.sale();coach.action({'action':'void-sale','id':'sale-one','sessionId':self.sid})
        self.assertEqual(coach.snapshot(self.sid)['metrics']['salesCents'],0)
        with coach.db() as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM sales').fetchone()[0],1)
    def test_two_active_sessions_forbidden(self):
        with self.assertRaises(HTTPException):coach.action({'action':'start','title':'Another show'})
    def test_no_viewer_or_conversion_estimates(self):
        self.feed([self.message()]);s=coach.snapshot(self.sid)
        self.assertNotIn('viewers',s['metrics']);self.assertNotIn('conversion',s['metrics'])
        self.assertIsNone(s['metrics']['aovCents'])
    def test_pending_answer_recovers_on_restart(self):
        with coach.db() as c:c.execute("INSERT INTO answers(id,session_id,t,question,status) VALUES('one',?,?,?,'pending')",(self.sid,time.time(),'Help'))
        coach.initialize();self.assertEqual(coach.snapshot(self.sid)['answers'][0]['status'],'failed')
    def test_proxy_authentication_and_allowlist(self):
        app=FastAPI()
        async def key(x_api_key: str | None=Header(None)):
            if x_api_key!='test-only':raise HTTPException(401)
        proxy.install(app,key)
        with TestClient(app) as client:
            self.assertEqual(client.get('/coach/snapshot').status_code,401)
            for method,path in [('post','snapshot'),('get','action'),('post','go-live'),('post','end')]:
                self.assertEqual(getattr(client,method)('/coach/'+path,headers={'x-api-key':'test-only'}).status_code,404)
            self.assertEqual(client.post('/coach/action',content='x'*12001,headers={'x-api-key':'test-only'}).status_code,413)
    def test_model_failure_is_recorded(self):
        with coach.db() as c:c.execute("INSERT INTO answers(id,session_id,t,question,status) VALUES('one',?,?,?,'pending')",(self.sid,time.time(),'Help'))
        with patch.object(httpx.AsyncClient,'get',side_effect=RuntimeError('offline')):asyncio.run(coach.answer('one',self.sid,'Help'))
        self.assertEqual(coach.snapshot(self.sid)['answers'][0]['status'],'failed')

if __name__=='__main__':unittest.main()
