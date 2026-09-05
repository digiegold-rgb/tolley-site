#!/usr/bin/env python3
"""Spark-side private still store for /generate Modal jobs.

Run on Spark (or the same host as quickgen.tolley.io). Vercel PUTs PNGs here
after Modal finishes; HQ loads them through GET /api/generate/jobs/:id/image.

    GENERATE_SPARK_STORE_KEY   required (same value as Vercel)
    GENERATE_SPARK_STORE_ROOT  default /home/jelly/growth-engine/shorts/generate-jobs
    GENERATE_SPARK_STORE_PORT  default 8765
    GENERATE_SPARK_STORE_HOST  default 127.0.0.1  (put a tunnel / Caddy in front)

    python3 spark/generate-store/server.py

Auth: Authorization: Bearer <key>  or  x-api-key: <key>
Paths: PUT/GET /generate-jobs/{job_id}/{index}
"""

from __future__ import annotations

import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

JOB_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
ROUTE_RE = re.compile(r"^/generate-jobs/([A-Za-z0-9_-]{1,80})/(\d+)$")


def _root() -> Path:
    raw = (os.environ.get("GENERATE_SPARK_STORE_ROOT") or "").strip()
    return Path(raw or "/home/jelly/growth-engine/shorts/generate-jobs").resolve()


def _key() -> str:
    return (os.environ.get("GENERATE_SPARK_STORE_KEY") or "").strip()


def _authorized(handler: BaseHTTPRequestHandler) -> bool:
    expected = _key()
    if not expected:
        return False
    auth = handler.headers.get("Authorization") or ""
    if auth.startswith("Bearer ") and auth[7:].strip() == expected:
        return True
    return (handler.headers.get("x-api-key") or "").strip() == expected


def _safe_file(job_id: str, index: int) -> Path:
    if not JOB_ID_RE.match(job_id):
        raise ValueError("invalid job id")
    if index < 0 or index > 7:
        raise ValueError("invalid index")
    root = _root()
    dest = (root / job_id / f"{index}.png").resolve()
    if dest != root and root not in dest.parents:
        raise ValueError("path escapes store root")
    return dest


class Handler(BaseHTTPRequestHandler):
    server_version = "tolley-generate-store/1"

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _deny(self) -> None:
        self._json(401, {"error": "unauthorized"})

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") == "/health":
            self._json(200, {"ok": True, "root": str(_root())})
            return
        if not _authorized(self):
            self._deny()
            return
        m = ROUTE_RE.match(self.path.split("?", 1)[0])
        if not m:
            self._json(404, {"error": "not found"})
            return
        try:
            dest = _safe_file(m.group(1), int(m.group(2)))
        except ValueError as exc:
            self._json(400, {"error": str(exc)})
            return
        if not dest.is_file():
            self._json(404, {"error": "not found"})
            return
        data = dest.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def do_PUT(self) -> None:  # noqa: N802
        if not _authorized(self):
            self._deny()
            return
        m = ROUTE_RE.match(self.path.split("?", 1)[0])
        if not m:
            self._json(404, {"error": "not found"})
            return
        try:
            dest = _safe_file(m.group(1), int(m.group(2)))
        except ValueError as exc:
            self._json(400, {"error": str(exc)})
            return
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 25 * 1024 * 1024:
            self._json(400, {"error": "invalid content-length"})
            return
        body = self.rfile.read(length)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(body)
        self._json(200, {"ok": True, "path": str(dest), "bytes": len(body)})

    def do_POST(self) -> None:  # noqa: N802
        self.do_PUT()


def main() -> None:
    if not _key():
        sys.stderr.write("GENERATE_SPARK_STORE_KEY is required\n")
        sys.exit(1)
    host = (os.environ.get("GENERATE_SPARK_STORE_HOST") or "127.0.0.1").strip()
    port = int((os.environ.get("GENERATE_SPARK_STORE_PORT") or "8765").strip() or "8765")
    _root().mkdir(parents=True, exist_ok=True)
    httpd = ThreadingHTTPServer((host, port), Handler)
    sys.stderr.write(f"generate-store on {host}:{port} root={_root()}\n")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
