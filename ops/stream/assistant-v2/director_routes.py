"""Both assistant dashboards, one sender at a time. No broadcast operations."""
import asyncio
import httpx
from fastapi import Depends, Request
from fastapi.responses import Response, JSONResponse


def install(app, require_key):
    allowed = {'admin': 'GET', 'admin.js': 'GET', 'admin.css': 'GET', 'snapshot': 'GET', 'action': 'POST'}
    lock = asyncio.Lock()

    async def proxy(version, path, request):
        if allowed.get(path) != request.method:
            return JSONResponse({'error': 'Not found'}, status_code=404)
        body = await request.body()
        if len(body) > 24000:
            return JSONResponse({'error': 'Request too large'}, status_code=413)
        port = 8112 if version == 2 else 8111
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                async def forward():
                    result = await client.request(request.method, f'http://127.0.0.1:{port}/{path}', content=body, headers={'content-type': 'application/json'})
                    headers = {k:v for k,v in result.headers.items() if k in ('content-type','cache-control','content-security-policy','referrer-policy','x-content-type-options')}
                    return Response(result.content, status_code=result.status_code, headers=headers)
                if path == 'action':
                    import json
                    try: action = json.loads(body).get('action')
                    except (ValueError, AttributeError): action = None
                    if action == 'start':
                        async with lock:
                            other = 8111 if version == 2 else 8112
                            try:
                                check = await client.get(f'http://127.0.0.1:{other}/snapshot')
                            except httpx.ConnectError:
                                if version == 1:  # Classic remains usable when V2 is stopped.
                                    return await forward()
                                raise
                            if check.status_code != 200 or check.json().get('paused') is not True or check.json().get('busy'):
                                return JSONResponse({'error':'Pause the other assistant and wait for it to finish before starting this version.'},status_code=409)
                            return await forward()
                return await forward()
        except httpx.HTTPError:
            return JSONResponse({'error':'Assistant unavailable. Broadcast controls are unaffected.'},status_code=503)

    @app.api_route('/whatnot-bot/{path}', methods=['GET','POST'], dependencies=[Depends(require_key)])
    async def classic(path: str, request: Request):
        return await proxy(1,path,request)

    @app.api_route('/whatnot-bot-v2/{path}', methods=['GET','POST'], dependencies=[Depends(require_key)])
    async def inventory(path: str, request: Request):
        return await proxy(2,path,request)
