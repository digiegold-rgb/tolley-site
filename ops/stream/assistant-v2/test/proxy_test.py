import importlib.util, unittest, tempfile, sqlite3
from pathlib import Path
from unittest.mock import patch
import httpx
from fastapi import FastAPI, Header, HTTPException
root=Path(__file__).resolve().parents[1]
def load(name):
 spec=importlib.util.spec_from_file_location(name,root/(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
routes=load('director_routes');migration=load('migrate')
class Routes(unittest.IsolatedAsyncioTestCase):
 async def test_auth_allowlist_and_aliases_use_exactly_one_worker(self):
  app=FastAPI();calls=[]
  async def auth(x_api_key: str=Header(default='')):
   if x_api_key!='fixture':raise HTTPException(401)
  routes.install(app,auth)
  async def handler(request):
   calls.append((request.url.port,request.url.path));return httpx.Response(200,json={'paused':True,'csrf':'same-worker'})
  real=httpx.AsyncClient
  async with real(transport=httpx.ASGITransport(app=app),base_url='http://fixture') as client:
   with patch.object(routes.httpx,'AsyncClient',side_effect=lambda **kw:real(transport=httpx.MockTransport(handler),**kw)):
    self.assertEqual((await client.get('/whatnot-bot/snapshot')).status_code,401)
    headers={'x-api-key':'fixture'}
    self.assertEqual((await client.get('/whatnot-bot-v2/private',headers=headers)).status_code,404)
    for prefix in ['whatnot-bot','whatnot-bot-v2']:
     self.assertEqual((await client.get(f'/{prefix}/snapshot',headers=headers)).json()['csrf'],'same-worker')
     self.assertEqual((await client.post(f'/{prefix}/action',headers=headers,json={'action':'start'})).status_code,200)
    self.assertEqual(len(calls),4);self.assertTrue(all(port==8112 for port,path in calls))
 def test_settings_migrate_once_without_overwriting_later_edits(self):
  with tempfile.TemporaryDirectory() as d:
   old=Path(d)/'old.db';new=Path(d)/'new.db'
   with sqlite3.connect(old) as c:
    c.execute('CREATE TABLE config(key TEXT PRIMARY KEY,value TEXT NOT NULL)');c.execute("INSERT INTO config VALUES('settings','original')");c.commit()
   self.assertTrue(migration.migrate_config(old,new))
   with sqlite3.connect(new) as c:
    self.assertEqual(c.execute("SELECT value FROM config WHERE key='settings'").fetchone()[0],'original');c.execute("UPDATE config SET value='new owner edit' WHERE key='settings'");c.commit()
   self.assertFalse(migration.migrate_config(old,new))
   with sqlite3.connect(new) as c:self.assertEqual(c.execute("SELECT value FROM config WHERE key='settings'").fetchone()[0],'new owner edit')
if __name__=='__main__':unittest.main()
