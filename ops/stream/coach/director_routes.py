"""Install only an authenticated, read-only-to-broadcast proxy into the director."""
import httpx
from fastapi import Depends, Request
from fastapi.responses import JSONResponse

def install(app, require_key):
    @app.api_route('/coach/{path}', methods=['GET','POST'], dependencies=[Depends(require_key)])
    async def coach(path: str, request: Request):
        if {'snapshot':'GET','action':'POST','ask':'POST'}.get(path) != request.method:
            return JSONResponse({'error':'Not found'},status_code=404)
        raw=await request.body()
        if len(raw)>12000:return JSONResponse({'error':'Request too large'},status_code=413)
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                r=await client.request(request.method, f'http://127.0.0.1:8106/{path}',params=request.query_params,content=raw,headers={'content-type':'application/json'})
                return JSONResponse(r.json(),status_code=r.status_code,headers={'Cache-Control':'no-store'})
        except Exception:
            return JSONResponse({'error':'Stream Coach is unavailable. Stream controls are unaffected.'},status_code=503)
