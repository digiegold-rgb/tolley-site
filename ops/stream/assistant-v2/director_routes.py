"""One Show Assistant. Both historic URL prefixes resolve to the same worker."""
import asyncio
import httpx
from fastapi import Depends, Request
from fastapi.responses import Response, JSONResponse


def install(app, require_key):
    allowed = {'admin': 'GET', 'admin.js': 'GET', 'admin.css': 'GET', 'snapshot': 'GET', 'action': 'POST'}
    lock = asyncio.Lock()

    async def proxy(path, request):
        if allowed.get(path) != request.method:
            return JSONResponse({'error': 'Not found'}, status_code=404)
        body = await request.body()
        if len(body) > 24000:
            return JSONResponse({'error': 'Request too large'}, status_code=413)
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                async def forward():
                    result = await client.request(request.method, f'http://127.0.0.1:8112/{path}', content=body, headers={'content-type': 'application/json'})
                    headers = {k:v for k,v in result.headers.items() if k in ('content-type','cache-control','content-security-policy','referrer-policy','x-content-type-options')}
                    return Response(result.content, status_code=result.status_code, headers=headers)
                if path == 'action':
                    import json
                    try: starting = json.loads(body).get('action') == 'start'
                    except (ValueError, AttributeError): starting = False
                    if starting:
                        async with lock:
                            return await forward()
                return await forward()
        except httpx.HTTPError:
            return JSONResponse({'error':'Show Assistant unavailable. Broadcast controls are unaffected.'},status_code=503)

    @app.api_route('/whatnot-bot/{path}', methods=['GET','POST'], dependencies=[Depends(require_key)])
    async def assistant(path: str, request: Request):
        return await proxy(path,request)

    @app.api_route('/whatnot-bot-v2/{path}', methods=['GET','POST'], dependencies=[Depends(require_key)])
    async def previous_v2_link(path: str, request: Request):
        return await proxy(path,request)
