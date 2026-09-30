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
from install import patched, patched_v2

SERVER = "rtmps://live-api-s.facebook.com:443/rtmp/"
PRIMARY, BACKUP = "FB-123456-0-secretPrimaryKey12", "FB-123456-1-secretBackupKey12"


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
        self.hidden, self.created_id = set(), "123456"  # hidden: Graph code 100, like a Live Producer video before it goes live
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
            result = {"id": self.created_id}
        elif path in self.hidden:
            return httpx.Response(400, json={"error": {"code": 100, "error_subcode": 33, "type": "GraphMethodException", "message": "unsafe-token-echo"}})
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
        keyed = patched_v2(result)
        self.assertEqual(patched_v2(keyed), keyed)
        self.assertIn("return FACEBOOK.key_tail()", keyed)
        with self.assertRaises(RuntimeError): patched_v2(source.replace("def dest_key_tail", "def renamed_tail"))

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

    def env_map(self):
        return dict(line.split("=", 1) for line in self.env.read_text().splitlines() if "=" in line)

    def install_app(self, pusher=None):
        state = SimpleNamespace(armed=False, destinations={"facebook": False}, save=lambda: None)
        obs = {"program_ready": False}
        pusher = pusher or SimpleNamespace(running=lambda: False, stop=lambda: None)
        app = FastAPI()
        from fastapi import Header
        async def key(x_api_key: str = Header(default="")):
            if x_api_key != "test-only": raise HTTPException(401)
        install(app, key, state, obs, {"facebook": pusher}, lambda: {"armed": state.armed, "facebook": dict(self.api.meta)}, self.api)
        return TestClient(app), state, obs, {"x-api-key": "test-only"}

    def test_manual_key_is_stored_and_never_echoed(self):
        self.hidden = {"123456"}
        meta = self.api.set_key(SERVER, PRIMARY, BACKUP)
        env = self.env_map()
        self.assertEqual(env["FACEBOOK_INGEST_MODE"], "manual")
        self.assertEqual(env["FACEBOOK_VIDEO_ID"], "123456")
        self.assertEqual(env["FACEBOOK_INGEST_URL"], SERVER + PRIMARY)
        self.assertEqual(env["FACEBOOK_INGEST_BACKUP"], SERVER + BACKUP)
        self.assertEqual(env["CAM_KEY"], "keep-me")
        self.assertEqual(self.env.stat().st_mode & 0o777, 0o600)
        self.assertEqual((meta["phase"], meta["verified"], meta["ingest"], meta["liveNow"], meta["videoId"]), ("KEYED", True, "manual", None, "123456"))
        self.assertNotIn("secret", json.dumps(meta))
        self.assertNotIn("secret", self.api.state_path.read_text())
        self.assertFalse(any(c[0] == "POST" for c in self.calls))
        self.assertEqual(self.api.key_tail(), PRIMARY[-6:])
        self.assertEqual(self.api.target(), SERVER + PRIMARY)
        for server in ("rtmps://live-api-s.facebook.com:443/rtmp", ""):  # missing slash, and Facebook's default server
            self.api.set_key(server, PRIMARY)
            self.assertEqual(self.env_map()["FACEBOOK_INGEST_URL"], SERVER + PRIMARY)
            self.assertEqual(self.env_map()["FACEBOOK_INGEST_BACKUP"], "")
        self.api.state_path.write_text(json.dumps({"uncertain": True, "videoId": "123456", "manual": True}))
        meta = self.api.set_key("", "", "")
        env = self.env_map()
        self.assertEqual((env["FACEBOOK_INGEST_MODE"], env["FACEBOOK_INGEST_URL"], env["FACEBOOK_VIDEO_ID"]), ("graph", "", ""))
        self.assertEqual((meta["phase"], meta["ingest"]), ("idle", "graph"))
        self.assertIsNone(self.api.target())
        self.assertEqual(self.api.key_tail(), "")
        self.assertTrue(json.loads(self.api.state_path.read_text())["uncertain"])  # clearing never settles a creation guard

    def test_manual_key_rejects_bad_input_and_running_sender(self):
        bad = [("rtmp://live-api-s.facebook.com/rtmp/", PRIMARY, ""), ("rtmps://facebook.com.attacker.test/rtmp/", PRIMARY, ""),
               ("rtmps://live-api-s.facebook.com:443/other/", PRIMARY, ""), ("rtmps://live-api-s.facebook.com:443/rtmp/?token=x", PRIMARY, ""),
               ("rtmps://key@live-api-s.facebook.com/rtmp/", PRIMARY, ""), (SERVER, "secretPrimaryKey12", ""), (SERVER, "FB-123456-0-short", ""),
               (SERVER, "FB-123456-0-secret Key12345", ""), (SERVER, PRIMARY, "FB-999999-1-secretBackupKey12"), (SERVER, PRIMARY, PRIMARY)]
        for server, key, backup in bad:
            with self.assertRaises(FacebookError, msg=(server, key, backup)) as caught:
                self.api.set_key(server, key, backup)
            self.assertNotIn("secret", str(caught.exception))
        self.assertNotIn("FACEBOOK_INGEST_MODE", self.env.read_text())
        self.page = "987654"
        with self.assertRaises(FacebookError): self.api.set_key(SERVER, PRIMARY)
        self.page = PAGE_ID
        pusher = SimpleNamespace(running=lambda: False, stop=lambda: None, fails=[1.0], next_try=99.0)
        client, state, obs, headers = self.install_app(pusher)
        self.assertEqual(client.post("/facebook/key", json={"key": PRIMARY}).status_code, 401)
        state.destinations["facebook"] = True
        self.assertEqual(client.post("/facebook/key", headers=headers, json={"server": SERVER, "key": PRIMARY}).status_code, 409)
        state.destinations["facebook"] = False
        pusher.running = lambda: True
        self.assertEqual(client.post("/facebook/key", headers=headers, json={"server": SERVER, "key": PRIMARY}).status_code, 409)
        pusher.running = lambda: False
        self.assertNotIn("FACEBOOK_INGEST_MODE", self.env.read_text())
        rejected = client.post("/facebook/key", headers=headers, json={"server": SERVER, "key": "nope"})
        self.assertEqual(rejected.status_code, 409)
        self.assertNotIn("nope", rejected.text)
        self.hidden = {"123456"}
        accepted = client.post("/facebook/key", headers=headers, json={"server": SERVER, "key": PRIMARY, "backup": BACKUP, "extra": {"ignored": 1}})
        self.assertEqual(accepted.status_code, 200)
        self.assertNotIn("secret", accepted.text)
        self.assertEqual(accepted.json()["phase"], "KEYED")
        self.assertEqual((pusher.fails, pusher.next_try), ([], 0.0))

    def test_manual_key_phase_and_send_gate(self):
        self.hidden = {"123456"}
        self.api.set_key(SERVER, PRIMARY)
        client, state, obs, headers = self.install_app()
        self.assertEqual(client.post("/facebook/send", headers=headers, json={"videoId": "123456"}).status_code, 409)
        state.armed, obs["program_ready"] = True, True
        self.assertEqual(client.post("/facebook/send", headers=headers, json={"videoId": "999999"}).status_code, 409)
        self.assertFalse(state.destinations["facebook"])
        self.assertEqual(client.post("/facebook/send", headers=headers, json={"videoId": "123456"}).status_code, 200)
        self.assertTrue(state.destinations["facebook"])
        self.assertEqual(client.post("/facebook/key", headers=headers, json={"server": SERVER, "key": BACKUP}).status_code, 409)
        # Jared goes live in Live Producer: Graph can now read the video; comments follow the LIVE phase.
        self.hidden, self.phase = set(), "LIVE"
        meta = self.api.refresh()
        self.assertEqual((meta["phase"], meta["liveNow"], meta["ingest"], meta["title"]), ("LIVE", True, "manual", "Test"))
        self.assertEqual(self.api.target(), SERVER + PRIMARY)
        self.phase = "VOD"  # show ended in Live Producer → watchdog stops the sender
        self.api.refresh()
        self.assertIsNone(self.api.target())
        self.hidden, self.phase = {"123456"}, "UNPUBLISHED"
        self.api.refresh()
        self.assertEqual(self.api.target(), SERVER + PRIMARY)
        self.api.meta["checkedAt"] = time.time() - 46
        self.assertIsNone(self.api.target())
        self.api.refresh()
        self.env.write_text(self.env.read_text().replace("FACEBOOK_INGEST_MODE=manual", "FACEBOOK_INGEST_MODE=graph"))
        self.assertIsNone(self.api.target())  # mode changed under a checked KEYED status: fail closed
        self.api.set_key(SERVER, PRIMARY)
        self.api.transport = httpx.MockTransport(lambda req: httpx.Response(400, json={"error": {"code": 190, "message": "secret-token"}}))
        meta = self.api.refresh()
        self.assertFalse(meta["verified"])
        self.assertIsNone(self.api.target())
        self.assertNotIn("secret-token", json.dumps(meta))
        self.api.transport = httpx.MockTransport(self.handle)
        state.destinations["facebook"] = False
        # Create Facebook preview while a hidden Live Producer key is loaded: make a Spark preview and switch to graph mode.
        self.created_id = "654321"
        meta = self.api.prepare("Rehearsal")
        env = self.env_map()
        self.assertEqual((meta["videoId"], meta["phase"], meta["ingest"]), ("654321", "UNPUBLISHED", "graph"))
        self.assertEqual((env["FACEBOOK_INGEST_MODE"], env["FACEBOOK_INGEST_BACKUP"]), ("graph", ""))
        self.assertEqual(env["FACEBOOK_INGEST_URL"], SERVER + "secret-stream-key")
        self.assertEqual(sum(c[0] == "POST" for c in self.calls), 1)


if __name__ == "__main__":
    unittest.main()
