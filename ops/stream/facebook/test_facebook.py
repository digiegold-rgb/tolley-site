"""Offline contract tests; no production credentials, streams or network."""
import asyncio
import importlib.util
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent))
from facebook_live import FacebookLive, FacebookError, CommentReader, PAGE_ID, safe_ingest, install
from install import patched


class FacebookTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.env = root / "stream.env"
        self.env.write_text(f"CAM_KEY=keep-me\nFACEBOOK_PAGE_ID={PAGE_ID}\nFACEBOOK_PAGE_TOKEN=secret-token\n")
        self.calls, self.phase, self.owner, self.page = [], "UNPUBLISHED", PAGE_ID, PAGE_ID
        self.fail_create, self.comments_fail = False, False
        self.comment_calls = []
        self.pages = []
        self.api = FacebookLive(self.env, root / "state.json", httpx.MockTransport(self.handle))

    def tearDown(self):
        self.temp.cleanup()

    def handle(self, req):
        self.calls.append((req.method, req.url.path, parse_qs(req.content.decode())))
        path = req.url.path.split("/v23.0/")[-1]
        if path == "me":
            result = {"id": self.page, "name": "Bound Page"}
        elif path == f"{PAGE_ID}/live_videos":
            if self.fail_create:
                raise httpx.ReadTimeout("unsafe-token-echo")
            result = {"id": "123456"}
        elif path.endswith("/comments"):
            self.comment_calls.append(dict(req.url.params))
            if self.comments_fail:
                raise httpx.ReadTimeout("unsafe-token-echo")
            result = self.pages.pop(0)
        else:
            result = {"id": path, "from": {"id": self.owner}, "status": self.phase, "title": "Test",
                      "secure_stream_url": "rtmps://live-api-s.facebook.com:443/rtmp/secret-stream-key"}
        return httpx.Response(200, json=result)

    def test_preview_is_unpublished_and_secret_free(self):
        meta = self.api.prepare("Rehearsal")
        posts = [call for call in self.calls if call[0] == "POST"]
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0][2]["status"], ["UNPUBLISHED"])
        self.assertEqual(posts[0][2]["published"], ["false"])
        self.assertFalse(meta["liveNow"])
        self.assertNotIn("secret", json.dumps(meta))
        self.assertNotIn("secret", self.api.state_path.read_text())
        self.assertIn("CAM_KEY=keep-me", self.env.read_text())
        self.assertEqual(self.env.stat().st_mode & 0o777, 0o600)
        self.api.prepare("Second click")
        self.assertEqual(sum(c[0] == "POST" for c in self.calls), 1)

    def test_ambiguous_creation_is_not_retried(self):
        self.fail_create = True
        for _ in range(2):
            with self.assertRaises(FacebookError) as caught:
                self.api.prepare("Test")
            self.assertNotIn("unsafe-token", str(caught.exception))
        self.assertEqual(sum(c[0] == "POST" for c in self.calls), 1)
        self.fail_create = False
        self.api.select("123456")
        self.assertFalse(json.loads(self.api.state_path.read_text())["uncertain"])

    def test_wrong_page_or_video_is_rejected(self):
        self.page = "987654"
        with self.assertRaises(FacebookError): self.api.prepare("Wrong Page")
        self.assertFalse(any(c[0] == "POST" for c in self.calls))
        self.page, self.owner = PAGE_ID, "987654"
        with self.assertRaises(FacebookError): self.api.select("123456")
        self.assertNotIn("FACEBOOK_INGEST_URL", self.env.read_text())

    def test_ingest_and_status_fail_closed(self):
        for value in ["rtmp://live-api-s.facebook.com/rtmp/key", "rtmps://facebook.com.attacker.test/rtmp/key", "https://live-api-s.facebook.com/rtmp/key", "rtmps://key@live-api-s.facebook.com/rtmp/key"]:
            with self.assertRaises(FacebookError): safe_ingest(value)
        self.api.select("123456")
        self.assertIsNotNone(self.api.target())
        self.api.meta["checkedAt"] = time.time() - 46
        self.assertIsNone(self.api.target())
        self.phase = "VOD"
        self.api.refresh()
        self.assertIsNone(self.api.target())

    def test_token_error_never_echoes_upstream(self):
        self.api.transport = httpx.MockTransport(lambda req: httpx.Response(400, json={"error": {"code": 190, "message": "secret-token"}}))
        meta = self.api.refresh()
        self.assertFalse(meta["verified"])
        self.assertIn("expired", meta["error"])
        self.assertNotIn("secret-token", json.dumps(meta))

    def test_comments_paging_reconnect_dedupe_and_show_change(self):
        self.phase = "LIVE"
        meta = self.api.select("123456")
        item = {"id": "comment-1", "message": "Hello", "created_time": "2026-09-29T12:00:00+0000"}
        self.pages = [{"data": [item], "paging": {"next": "https://attacker.invalid/?access_token=secret", "cursors": {"after": "cursor"}}}, {"data": [item]}, {"data": [item]}]
        reader = CommentReader(self.api)
        messages = reader.poll(meta)
        self.assertEqual(messages[0]["u"], "Facebook viewer")
        self.comments_fail = True
        with self.assertRaises(FacebookError): reader.poll(meta)
        self.assertEqual(self.comment_calls[-1]["after"], "cursor")
        self.comments_fail = False
        self.assertEqual(reader.poll(meta), [])
        self.assertIn("since", self.comment_calls[-1])
        self.assertEqual(len(reader.poll({**meta, "source": "facebook:new-show", "videoId": "987654"})), 1)
        self.assertNotIn("since", self.comment_calls[-1])
        self.assertEqual(reader.poll({**meta, "phase": "VOD"}), [])
        self.assertFalse(any("attacker" in c[1] for c in self.calls))

    def test_authenticated_preview_sender_requires_ready_house(self):
        state = SimpleNamespace(armed=False, destinations={"facebook": False}, save=lambda: None)
        obs = {"program_ready": False}
        pusher = SimpleNamespace(running=lambda: False, stop=lambda: None)
        app = FastAPI()
        from fastapi import Header
        async def key(x_api_key: str = Header(default="")):
            if x_api_key != "test-only": raise HTTPException(401)
        install(app, key, state, obs, {"facebook": pusher}, lambda: {"armed": state.armed}, self.api)
        client = TestClient(app)  # no lifespan worker; requests use mocks only
        self.assertEqual(client.post("/facebook/prepare", json={}).status_code, 401)
        headers = {"x-api-key": "test-only"}
        self.assertEqual(client.post("/facebook/send", headers=headers, json={"videoId": "123456"}).status_code, 409)
        self.api.select("123456")
        state.armed, obs["program_ready"] = True, True
        self.assertEqual(client.post("/facebook/send", headers=headers, json={"videoId": "999999"}).status_code, 409)
        self.assertFalse(state.destinations["facebook"])
        self.assertEqual(client.post("/facebook/send", headers=headers, json={"videoId": "123456"}).status_code, 200)
        self.assertTrue(state.destinations["facebook"])
        self.assertEqual(client.post("/facebook/prepare", headers=headers, json={}).status_code, 409)
        state.destinations["facebook"] = False
        self.phase = "LIVE"
        self.assertEqual(client.post("/facebook/send", headers=headers, json={"videoId": "123456"}).status_code, 409)
        self.assertEqual(client.post("/facebook/send", headers=headers, json={"videoId": "123456", "confirmLive": "123456"}).status_code, 200)
        self.assertFalse(any(c[0] == "POST" for c in self.calls))

    def test_director_patches_block_generic_start_and_reset_saved_selection(self):
        import ast
        # Read source only: importing director would access real OBS/camera credentials.
        source = (Path.home()/"stream-director/director.py").read_text()
        result = patched(source)
        self.assertEqual(patched(result), result)
        tree = ast.parse(result)
        for name, argument in [("do_go_live", {"facebook": True}), ("destinations", {"facebook": True})]:
            fn = next(node for node in tree.body if isinstance(node, ast.AsyncFunctionDef) and node.name == name)
            fn.decorator_list = []
            env = {"HTTPException": HTTPException, "STATE": SimpleNamespace(destinations={"facebook": False})}
            exec(compile(ast.Module(body=[fn], type_ignores=[]), "guard", "exec"), env)
            with self.assertRaises(HTTPException): asyncio.run(env[name](argument))
        self.assertIn('STATE.destinations["facebook"] = False', result)

    def test_merged_chat_epoch_pagination_and_source_reset(self):
        import ast
        import itertools
        import threading
        from collections import deque
        from fastapi.responses import JSONResponse
        source = (Path(__file__).parents[1]/"coach/stream_chat.py").read_text()
        nodes = [n for n in ast.parse(source).body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in ("push", "chat")]
        for node in nodes: node.decorator_list = []
        state = {"facebook": {"source": "fb:first", "liveNow": True}, "youtube": {"source": "yt:first", "liveNow": True}, "tiktok": {}}
        env = {"LOCK": threading.Lock(), "MSGS": deque(maxlen=2000), "SEEN": {}, "SOURCES": {}, "SEQ": itertools.count(1), "time": time, "STATE": state, "EPOCH": "new-process", "JSONResponse": JSONResponse}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "chat-test", "exec"), env)
        push = env["push"]
        def poll(**args): return json.loads(asyncio.run(env["chat"](**args)).body)
        push("fb", "Viewer", "hello", extra={"source": "fb:first", "eventId": "1"})
        push("fb", "Viewer", "hello", extra={"source": "fb:first", "eventId": "1"})
        push("yt", "Viewer", "YouTube hello", extra={"source": "yt:first", "eventId": "1"})
        first = poll(since=500, epoch="old-process", limit=1)
        self.assertTrue(first["reset"])
        self.assertEqual(len(first["items"]), 1)
        second = poll(since=first["last"], epoch=first["epoch"])
        self.assertEqual([m["p"] for m in second["items"]], ["yt"])
        state["facebook"]["source"] = "fb:second"
        push("fb", "New viewer", "new show", extra={"source": "fb:second", "eventId": "1"})
        self.assertEqual([m["m"] for m in poll()["items"]], ["YouTube hello", "new show"])
        state["facebook"]["liveNow"] = False
        self.assertEqual([m["p"] for m in poll()["items"]], ["yt"])


if __name__ == "__main__":
    unittest.main()
