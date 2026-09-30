import asyncio, importlib.util, unittest
from pathlib import Path
from unittest.mock import patch
import httpx
from fastapi import FastAPI, Header, HTTPException
spec=importlib.util.spec_from_file_location('routes',Path(__file__).resolve().parents[1]/'director_routes.py')
routes=importlib.util.module_from_spec(spec);spec.loader.exec_module(routes)

class Routes(unittest.IsolatedAsyncioTestCase):
    async def test_auth_allowlist_and_mutual_exclusion(self):
        app=FastAPI();states={8111:True,8112:True};starts=[];down=False
        async def auth(x_api_key: str=Header(default='')):
            if x_api_key!='fixture':raise HTTPException(401)
        routes.install(app,auth)
        async def handler(request):
            port=request.url.port
            if down and port==8112:raise httpx.ConnectError('Stopped')
            if request.url.path=='/snapshot':return httpx.Response(200,json={'paused':states[port],'busy':False})
            if request.url.path=='/action':
                import json
                if json.loads(request.content).get('action')=='start':
                    await asyncio.sleep(.01);states[port]=False;starts.append(port)
            return httpx.Response(200,json={'ok':True})
        real=httpx.AsyncClient
        async with real(transport=httpx.ASGITransport(app=app),base_url='http://fixture') as client:
            with patch.object(routes.httpx,'AsyncClient',side_effect=lambda **kw:real(transport=httpx.MockTransport(handler),**kw)):
                self.assertEqual((await client.get('/whatnot-bot-v2/snapshot')).status_code,401)
                headers={'x-api-key':'fixture'}
                self.assertEqual((await client.get('/whatnot-bot-v2/private',headers=headers)).status_code,404)
                results=await asyncio.gather(*[client.post(f'/{name}/action',headers=headers,json={'action':'start'}) for name in ['whatnot-bot','whatnot-bot-v2']])
                self.assertEqual(sorted(r.status_code for r in results),[200,409]);self.assertEqual(len(starts),1)
                states[8111]=states[8112]=True;down=True
                self.assertEqual((await client.post('/whatnot-bot/action',headers=headers,json={'action':'start'})).status_code,200)
if __name__=='__main__':unittest.main()
