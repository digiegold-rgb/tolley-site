"""Exercise real resumable transfers against an isolated tusd data directory."""
import asyncio
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from aiohttp.test_utils import TestClient, TestServer
from aiohttp import web
from upload_proxy import create_app


class UploadTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        self.server = subprocess.Popen([os.path.expanduser("~/.local/bin/tusd"), "-host", "127.0.0.1",
            "-port", str(port), "-upload-dir", self.directory.name, "-behind-proxy", "-disable-download"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.headers = {"Authorization": "Bearer test-only", "Tus-Resumable": "1.0.0", "Origin": "https://www.tolley.io"}
        self.client = TestClient(TestServer(create_app("test-only", f"http://127.0.0.1:{port}", self.directory.name)))
        await self.client.start_server()
        for _ in range(50):
            try:
                reader, writer = await asyncio.open_connection("127.0.0.1", port)
                writer.close()
                await writer.wait_closed()
                break
            except OSError:
                await asyncio.sleep(.1)
        else:
            self.fail("isolated tusd did not start")

    async def asyncTearDown(self):
        await self.client.close()
        self.server.terminate()
        self.server.wait(timeout=10)
        self.directory.cleanup()

    async def test_resume_and_authentication(self):
        for method in ("POST", "PATCH", "HEAD", "DELETE", "GET"):
            response = await self.client.request(method, "/files/", headers={"Authorization": "Bearer wrong"})
            self.assertEqual(response.status, 401)
        response = await self.client.post("/files/", headers={**self.headers, "Upload-Length": "8"}, data=b"")
        self.assertEqual(response.status, 201, await response.text())
        self.assertTrue(response.headers["Location"].startswith("https://upload.tolley.io/files/"))
        path = "/files/" + response.headers["Location"].rsplit("/", 1)[1]
        response = await self.client.patch(path, headers={**self.headers, "Upload-Offset": "0", "Content-Type": "application/offset+octet-stream"}, data=b"test")
        self.assertEqual(response.status, 204)
        response = await self.client.head(path, headers=self.headers)
        self.assertEqual(response.headers["Upload-Offset"], "4")
        response = await self.client.patch(path, headers={**self.headers, "Upload-Offset": "4", "Content-Type": "application/offset+octet-stream"}, data=b"data")
        self.assertEqual(response.status, 204)
        self.assertEqual((Path(self.directory.name) / path.rsplit("/", 1)[1]).read_bytes(), b"testdata")
        self.assertEqual((await self.client.get(path, headers=self.headers)).status, 404)
        self.assertEqual((await self.client.delete(path, headers=self.headers)).status, 204)

    async def test_cors_and_bounds(self):
        response = await self.client.options("/files/", headers={"Origin": "https://www.tolley.io"})
        self.assertEqual(response.status, 200)
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], "https://www.tolley.io")
        self.assertEqual((await self.client.options("/files/", headers={"Origin": "https://evil.example"})).status, 403)
        for length in ("-1", str(21 * 1024**3)):
            response = await self.client.post("/files/", headers={**self.headers, "Upload-Length": length}, data=b"")
            self.assertEqual(response.status, 413)
        response = await self.client.post("/files/", headers={**self.headers, "Upload-Defer-Length": "1"}, data=b"")
        self.assertEqual(response.status, 400)
        with patch("upload_proxy.shutil.disk_usage") as usage:
            usage.return_value.free = 0
            response = await self.client.post("/files/", headers={**self.headers, "Upload-Length": "8"}, data=b"")
            self.assertEqual(response.status, 507)

    async def test_completion_hook_adapts_v2_payload(self):
        received = []
        async def intake(request):
            self.assertEqual(request.headers.get("Authorization"), "Bearer test-only")
            received.append(await request.json())
            return web.json_response({"ok": True})
        app = web.Application()
        app.router.add_post("/intake", intake)
        server = TestServer(app)
        await server.start_server()
        path = Path(self.directory.name) / "test-file"
        path.write_bytes(b"test")
        payload = {"Event": {"Upload": {"ID": path.name, "Storage": {"Path": str(path)}, "MetaData": {"filename": "test.mp4"}}}}
        try:
            proc = await asyncio.create_subprocess_exec("python3", str(Path(__file__).with_name("upload_finished.py")),
                env={**os.environ, "CONTENT_API_KEY": "test-only", "TUS_STORAGE": self.directory.name, "CONTENT_INTAKE_URL": str(server.make_url("/intake"))},
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout, stderr = await proc.communicate(json.dumps(payload).encode())
            self.assertEqual(proc.returncode, 0, stderr.decode())
            self.assertEqual(received[0]["Upload"]["Storage"]["Path"], "/srv/tusd-data/data/test-file")
        finally:
            await server.close()


if __name__ == "__main__":
    unittest.main()
