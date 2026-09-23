import asyncio
import importlib.util
import json
from pathlib import Path
import sys
import time
import types
import unittest
from unittest.mock import patch

import httpx
from fastapi import FastAPI, HTTPException, Request
from core import KeywordGate
from director_routes import install
from render import frame, DURATION


class KeywordTests(unittest.TestCase):
    def setUp(self):
        self.now = 100.
        self.gate = KeywordGate(lambda: self.now)

    def word(self, word="fireworks", end=1., confidence=.95):
        return {"result": [{"word": word, "end": end, "conf": confidence}]}

    def test_cue_confidence_and_whole_words(self):
        for word in ("fire", "works", "fireworksstore", "firefighter"):
            self.assertIsNone(self.gate.recognize(self.word(word), True))
            self.gate.reset_audio()
        self.assertIsNone(self.gate.recognize(self.word(confidence=.4), True))
        self.assertEqual(self.gate.recognize(self.word(end=2.), True), "fireworks")

    def test_off_air_and_duplicate_final_do_not_fire(self):
        self.assertIsNone(self.gate.recognize(self.word(), False))
        self.assertEqual(self.gate.recognize(self.word(), True), "fireworks")
        self.now += 30
        self.assertIsNone(self.gate.recognize(self.word(), True))

    def test_reconnect_retains_cooldown(self):
        self.gate.recognize(self.word(), True)
        self.gate.reset_audio()
        self.now += 2
        self.assertIsNone(self.gate.recognize(self.word(), True))
        self.now += 12
        self.assertEqual(self.gate.recognize(self.word("firework", end=2), True), "firework")

    def test_split_compound_is_distinct_from_fireplace_or_separated_words(self):
        words = [{"word": "fire", "conf": .9, "start": 0., "end": .4},
                 {"word": "work", "conf": .95, "start": .4, "end": .8}]
        self.assertEqual(self.gate.recognize({"result": words}, True), "firework")
        self.gate = KeywordGate(lambda: self.now)
        words[1]["start"] = 1.
        words[1]["end"] = 1.5
        self.assertIsNone(self.gate.recognize({"result": words}, True))

    def test_overlay_starts_and_ends_transparent(self):
        self.assertIsNone(frame(0, 270, 480).getbbox())
        self.assertIsNone(frame(DURATION-.05, 270, 480).getbbox())
        image = frame(2.7, 270, 480)
        self.assertIsNotNone(image.getbbox())
        alpha = image.getchannel("A")
        self.assertGreater(alpha.histogram()[0], 270*480*.5)
        self.assertEqual(alpha.getpixel((0, 479)), 0)


class DirectorTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.calls = []
        self.state = types.SimpleNamespace(armed=True, privacy=False, live_since=123., event=lambda *a: None)
        self.obs_state = {"obs_streaming": True, "program_ready": True, "obs_scene": "Live"}
        self.connected = True
        def obs_call(*args):
            self.calls.append(args)
            return types.SimpleNamespace(output_active=False)
        obs = types.SimpleNamespace(scene=lambda: "Live", call=obs_call)
        async def obs_run(fn, *args):
            return fn(*args)
        async def auth(request: Request):
            if request.headers.get("x-api-key") != "test-key":
                raise HTTPException(401)
        app = FastAPI()
        install(app, auth, self.state, self.obs_state, obs, obs_run,
                lambda: {"cameras": [{"slot": 1, "audioLive": True, "connected": self.connected}]})
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", headers={"x-api-key": "test-key"})

    async def asyncTearDown(self):
        await self.client.aclose()

    async def cue(self, **overrides):
        return await self.client.post("/effects/firework", json={"id": "one", "at": time.time(), "epoch": 123., **overrides})

    async def test_authentication_and_allowlist(self):
        self.assertEqual((await self.client.get("/effects/gate", headers={"x-api-key": "wrong"})).status_code, 401)
        self.assertEqual((await self.client.post("/effects/anything", json={})).status_code, 404)
        self.assertEqual(self.calls, [])

    async def test_privacy_off_air_and_no_mic(self):
        self.state.privacy = True
        self.assertEqual((await self.cue()).status_code, 409)
        self.state.privacy = False
        self.state.armed = False
        self.assertEqual((await self.cue()).status_code, 409)
        self.state.armed = True
        self.connected = False
        self.assertEqual((await self.cue()).status_code, 409)
        self.assertEqual(self.calls, [])

    async def test_stale_cue_and_previous_show(self):
        self.assertEqual((await self.cue(at=time.time()-5)).status_code, 409)
        self.assertEqual((await self.cue(epoch=122.)).status_code, 409)
        self.assertEqual(self.calls, [])

    async def test_replay_and_cooldown(self):
        self.assertEqual((await self.cue()).status_code, 200)
        self.assertEqual((await self.cue()).json()["replay"], True)
        self.assertEqual((await self.cue(id="two")).status_code, 429)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(self.calls[0][1], "Voice Fireworks")

    async def test_preview_cannot_run_during_show(self):
        r = await self.client.post("/effects/test", json={"id": "test", "at": time.time()})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self.calls, [])

    async def test_hidden_effect_expires_by_wall_clock(self):
        real_sleep = asyncio.sleep
        async def fast_sleep(seconds):
            self.assertEqual(seconds, 6.2)
            await real_sleep(0)
        with patch("director_routes.asyncio.sleep", fast_sleep):
            self.assertEqual((await self.cue()).status_code, 200)
            await real_sleep(.02)
        self.assertEqual(self.calls[-1][-1], "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP")


if __name__ == "__main__":
    unittest.main()
