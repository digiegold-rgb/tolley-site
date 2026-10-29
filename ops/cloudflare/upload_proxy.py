#!/usr/bin/env python3
"""Authenticated, streaming front door for the private tusd listener."""
import asyncio
import hmac
import json
import os
from pathlib import Path
import shutil

from aiohttp import ClientSession, ClientTimeout, web

ORIGINS = {"https://www.tolley.io", "https://tolley.io"}
MAX_FILE = 20 * 1024**3
MAX_CHUNK = 8 * 1024**2
MAX_STORAGE = 50 * 1024**3
MIN_FREE = 20 * 1024**3
HOP_HEADERS = {"connection", "transfer-encoding", "keep-alive", "upgrade", "proxy-authorization", "proxy-authenticate", "te", "trailer"}


def create_app(token=None, upstream=None, storage=None):
    token = token if token is not None else os.environ.get("CONTENT_API_KEY", "")
    if not token:
        raise RuntimeError("CONTENT_API_KEY is required")
    upstream = upstream or os.environ.get("TUS_UPSTREAM", "http://127.0.0.1:8091")
    storage = Path(storage or os.environ.get("TUS_STORAGE", "/home/jelly/video-incoming"))
    create_lock = asyncio.Lock()

    @web.middleware
    async def access(request, handler):
        origin = request.headers.get("Origin")
        if origin and origin not in ORIGINS:
            return web.json_response({"error": "Origin not allowed"}, status=403)
        cors = {"Vary": "Origin", "Cache-Control": "no-store"}
        if origin:
            cors.update({"Access-Control-Allow-Origin": origin,
                         "Access-Control-Allow-Methods": "OPTIONS, POST, PATCH, HEAD, DELETE",
                         "Access-Control-Allow-Headers": "Authorization, Content-Type, Tus-Resumable, Upload-Length, Upload-Offset, Upload-Metadata, Upload-Defer-Length, Upload-Concat",
                         "Access-Control-Expose-Headers": "Location, Tus-Resumable, Tus-Version, Tus-Extension, Tus-Max-Size, Upload-Offset, Upload-Length"})
        if request.method != "OPTIONS" and not hmac.compare_digest(request.headers.get("Authorization", ""), "Bearer " + token):
            response = web.json_response({"error": "Unauthorized"}, status=401)
        else:
            response = await handler(request)
        response.headers.update(cors)
        return response

    app = web.Application(middlewares=[access], client_max_size=MAX_CHUNK)

    async def session_context(app):
        async with ClientSession(timeout=ClientTimeout(total=300), auto_decompress=False) as client:
            app["client"] = client
            yield
    app.cleanup_ctx.append(session_context)

    def storage_available(length):
        # Include reserved but not yet uploaded bytes, so concurrent resumable
        # uploads cannot each reserve all remaining disk space.
        reserved = 0
        for path in storage.glob("*.info"):
            item = json.loads(path.read_text())
            reserved += max(0, int(item.get("Size", 0)) - int(item.get("Offset", 0)))
        used = sum(p.stat().st_size for p in storage.iterdir() if p.is_file())
        return used + reserved + length <= MAX_STORAGE and shutil.disk_usage(storage).free - reserved - length >= MIN_FREE

    async def forward(request):
        if not request.path.startswith("/files/") or request.method not in {"OPTIONS", "POST", "PATCH", "HEAD", "DELETE"}:
            return web.json_response({"error": "Not found"}, status=404)
        if request.method in {"PATCH", "POST"} and (request.content_length is None or request.content_length > MAX_CHUNK):
            return web.json_response({"error": "Upload chunks must be at most 8 MiB"}, status=413)
        if request.method == "POST":
            if request.path != "/files/" or "Upload-Defer-Length" in request.headers or "Upload-Concat" in request.headers:
                return web.json_response({"error": "A fixed upload length is required"}, status=400)
            try:
                length = int(request.headers.get("Upload-Length", ""))
            except ValueError:
                return web.json_response({"error": "Upload-Length is required"}, status=400)
            if length < 1 or length > MAX_FILE:
                return web.json_response({"error": "Maximum video size is 20 GiB"}, status=413)
            async with create_lock:
                if not storage_available(length):
                    return web.json_response({"error": "Upload storage is full"}, status=507)
                return await relay(request)
        return await relay(request)

    async def relay(request):
        headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_HEADERS | {"host", "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-for"}}
        headers.update({"X-Forwarded-Host": "upload.tolley.io", "X-Forwarded-Proto": "https"})
        try:
            async with app["client"].request(request.method, upstream + request.rel_url.path_qs,
                    headers=headers, data=request.content.iter_chunked(65536) if request.can_read_body else None,
                    allow_redirects=False) as response:
                # tusd returns small protocol responses; uploaded bytes stream above.
                body = await response.content.read(65536)
                out = {k: v for k, v in response.headers.items() if k.lower() not in HOP_HEADERS | {"content-length"} and not k.lower().startswith("access-control-")}
                return web.Response(status=response.status, headers=out, body=body)
        except (OSError, asyncio.TimeoutError):
            return web.json_response({"error": "Upload service unavailable"}, status=503)

    app.router.add_route("*", "/{path:.*}", forward)
    return app


if __name__ == "__main__":
    web.run_app(create_app(), host="127.0.0.1", port=8090, access_log=None)
