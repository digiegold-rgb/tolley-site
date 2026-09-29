"""Facebook LIVE preview and read-only comments. No public-publish API is exposed.

Meta Graph v23: Page.live_videos, LiveVideo.from/status/secure_stream_url/comments.
Credentials stay in stream.env; API responses/logs contain only allowlisted metadata.
"""
from __future__ import annotations

import asyncio
import fcntl
import json
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx

PAGE_ID = "1156652300855210"
API = "https://graph.facebook.com/v23.0"
ENV_PATH = Path.home() / ".config/tolley-security/stream.env"
STATE_PATH = Path.home() / "stream-director/facebook-state.json"
ACCEPTED = {"UNPUBLISHED", "LIVE"}


class FacebookError(Exception):
    """Only fixed, credential-free messages may cross the API boundary."""


def env_read(path=ENV_PATH):
    return dict(line.split("=", 1) for line in path.read_text().splitlines()
                if "=" in line and not line.startswith("#"))


def env_update(values, path=ENV_PATH):
    # Do not create another copy of platform keys, even a temporary file.
    with path.open("r+") as file:
        fcntl.flock(file, fcntl.LOCK_EX)
        lines = [line for line in file.read().splitlines() if line.split("=", 1)[0] not in values]
        for key, value in values.items():
            if "\n" in value or "\r" in value:
                raise FacebookError("Invalid credential format")
            lines.append(f"{key}={value}")
        file.seek(0)
        file.write("\n".join(lines) + "\n")
        file.truncate()
        file.flush()
        import os
        os.fchmod(file.fileno(), 0o600)
        os.fsync(file.fileno())


def safe_ingest(value):
    url = urlparse(value)
    host = url.hostname or ""
    if (url.scheme != "rtmps" or not host.endswith(".facebook.com") or
            url.username or url.password or url.fragment or not url.path.startswith("/rtmp/")):
        raise FacebookError("Facebook returned an unexpected secure ingest address")
    return value


class FacebookLive:
    def __init__(self, env_path=ENV_PATH, state_path=STATE_PATH, transport=None):
        self.env_path, self.state_path, self.transport = env_path, state_path, transport
        self.meta = {"connected": False, "verified": False, "pageId": PAGE_ID,
                     "pageName": "Ruthann’s Treasure Haul", "videoId": "", "source": "",
                     "phase": "unknown", "liveNow": None, "error": "", "checkedAt": 0}
        self.mutation_lock = asyncio.Lock()

    def graph(self, path, params=None, data=None):
        env = env_read(self.env_path)
        if env.get("FACEBOOK_PAGE_ID") != PAGE_ID or not env.get("FACEBOOK_PAGE_TOKEN"):
            raise FacebookError("Reconnect the Treasure Hauls Facebook Page")
        try:
            with httpx.Client(timeout=4, transport=self.transport) as client:
                r = client.request("POST" if data is not None else "GET", f"{API}/{path}",
                                   params=params, data=data,
                                   headers={"Authorization": "Bearer " + env["FACEBOOK_PAGE_TOKEN"]})
                result = r.json()
            if not r.is_success or result.get("error"):
                code = result.get("error", {}).get("code")
                if code == 190:
                    raise FacebookError("Facebook connection expired; reconnect the Page in social settings")
                raise FacebookError(f"Facebook request failed (HTTP {r.status_code}, code {code if isinstance(code, int) else 'unknown'}). Check Page access in Live Producer")
            return result
        except FacebookError:
            raise
        except Exception:
            raise FacebookError("Facebook could not be reached; retry the status check") from None

    def identity(self):
        page = self.graph("me", {"fields": "id,name"})
        if page.get("id") != PAGE_ID:
            raise FacebookError("Facebook token belongs to another Page; connection blocked")
        return {"pageId": PAGE_ID, "pageName": str(page.get("name", "Facebook Page"))[:120]}

    def video(self, video_id, ingest=False):
        if not re.fullmatch(r"\d{5,40}", video_id):
            raise FacebookError("Enter the Facebook live-video ID from Live Producer")
        fields = "id,from,status,title" + (",secure_stream_url" if ingest else "")
        video = self.graph(video_id, {"fields": fields})
        if video.get("id") != video_id or video.get("from", {}).get("id") != PAGE_ID:
            raise FacebookError("This live video does not belong to the Treasure Hauls Page")
        return video

    def refresh(self):
        try:
            identity = self.identity()
            selected = env_read(self.env_path).get("FACEBOOK_VIDEO_ID", "")
            video = self.video(selected) if selected else None
            phase = video.get("status", "unknown") if video else "idle"
            self.meta = {**identity, "verified": True, "connected": False,
                         "videoId": selected, "source": f"facebook:{PAGE_ID}:{selected}" if selected else "",
                         "title": str(video.get("title", ""))[:120] if video else "",
                         "phase": phase, "liveNow": phase == "LIVE", "error": "", "checkedAt": time.time()}
        except FacebookError as error:
            self.meta = {**self.meta, "verified": False, "connected": False, "liveNow": None,
                         "error": str(error), "checkedAt": time.time()}
        return dict(self.meta)

    def target(self):
        if (not self.meta.get("verified") or self.meta.get("phase") not in ACCEPTED or
                time.time() - self.meta.get("checkedAt", 0) > 45):
            return None
        env = env_read(self.env_path)
        if env.get("FACEBOOK_VIDEO_ID") != self.meta.get("videoId"):
            return None
        try:
            return safe_ingest(env.get("FACEBOOK_INGEST_URL", ""))
        except FacebookError:
            return None

    def select(self, video_id):
        self.identity()
        video = self.video(video_id, ingest=True)
        if video.get("status") not in ACCEPTED:
            raise FacebookError("Choose an unpublished preview or an active live video")
        target = safe_ingest(video.get("secure_stream_url", ""))
        env_update({"FACEBOOK_VIDEO_ID": video_id, "FACEBOOK_INGEST_URL": target}, self.env_path)
        self.state_path.write_text(json.dumps({"uncertain": False, "videoId": video_id}))
        return self.refresh()

    def prepare(self, title):
        self.identity()
        state = json.loads(self.state_path.read_text()) if self.state_path.exists() else {}
        if state.get("uncertain"):
            raise FacebookError("A previous preview request was not confirmed. Open Live Producer and select its video ID; do not create duplicates")
        selected = env_read(self.env_path).get("FACEBOOK_VIDEO_ID", "")
        if selected:
            current = self.video(selected)
            if current.get("status") in ACCEPTED:
                return self.select(selected)
        # Record intent BEFORE POST. An ambiguous timeout must never create duplicates.
        self.state_path.write_text(json.dumps({"uncertain": True, "requestedAt": time.time()}))
        created = self.graph(f"{PAGE_ID}/live_videos", data={
            "status": "UNPUBLISHED", "published": "false", "title": title[:120],
            "description": "Treasure Hauls live show. Shop on Whatnot: https://www.whatnot.com/user/treasure_hauls"})
        video_id = str(created.get("id", ""))
        self.state_path.write_text(json.dumps({"uncertain": True, "videoId": video_id}))
        # Never forward video if Meta returned a public show unexpectedly.
        video = self.video(video_id)
        if video.get("status") != "UNPUBLISHED":
            raise FacebookError("Facebook did not confirm an unpublished preview. Check Live Producer before proceeding")
        return self.select(video_id)


class CommentReader:
    """Cursor survives transient reconnects; source changes start a new cursor.

    Always construct the request locally. Never follow Graph paging URLs, which
    may include tokens. Re-scan the chronological edge after exhaustion to find
    new comments; bounded IDs suppress replay. Polling pages drains backlog.
    """
    def __init__(self, api):
        self.api, self.source, self.after = api, "", ""
        self.seen = {}  # retained for the session; bounded below
        self.since = 0
        self.watermark = 0

    def poll(self, meta):
        source = meta.get("source", "")
        if not meta.get("verified") or meta.get("phase") != "LIVE":
            return []
        if source != self.source:
            self.source, self.after, self.seen = source, "", {}
            self.since = self.watermark = 0
        params = {"fields": "id,message,from,created_time", "order": "chronological", "filter": "stream", "limit": 100}
        if self.after:
            params["after"] = self.after
        if self.since:
            params["since"] = self.since
        try:
            result = self.api.graph(f'{meta["videoId"]}/comments', params)
        except FacebookError:
            # Resume from the last timestamp if Graph expires a paging cursor.
            self.after = ""
            self.since = max(0, self.watermark - 2)
            raise
        comments = []
        for item in result.get("data", []):
            event_id = str(item.get("id", ""))
            try:
                stamp = int(datetime.fromisoformat(item.get("created_time", "").replace("Z", "+00:00")).timestamp())
            except (ValueError, TypeError):
                stamp = int(time.time())
            self.watermark = max(self.watermark, stamp)
            if not event_id or event_id in self.seen:
                continue
            self.seen[event_id] = True
            if len(self.seen) > 20000:
                self.seen.pop(next(iter(self.seen)))
            if item.get("message"):
                author = item.get("from") or {}
                comments.append({"u": author.get("name") or "Facebook viewer", "m": item["message"],
                                 "t": stamp, "source": source, "eventId": event_id, "userId": str(author.get("id", ""))})
        paging = result.get("paging", {})
        self.after = str(paging.get("cursors", {}).get("after", "")) if paging.get("next") else ""
        if not self.after:
            self.since = max(0, self.watermark - 2)
        return comments


def install(app, require_key, state, obs_state, pushers, status_payload, api):
    from fastapi import Depends, HTTPException

    @app.post("/facebook/prepare", dependencies=[Depends(require_key)])
    async def prepare(body: dict):
        async with api.mutation_lock:
            if state.destinations.get("facebook") or pushers["facebook"].running():
                raise HTTPException(409, "Stop the Facebook sender before preparing another show")
            try:
                return await asyncio.to_thread(api.prepare, str(body.get("title") or "Treasure Hauls live show"))
            except FacebookError as error:
                raise HTTPException(409, str(error)) from None

    @app.post("/facebook/select", dependencies=[Depends(require_key)])
    async def select(body: dict):
        async with api.mutation_lock:
            if state.destinations.get("facebook") or pushers["facebook"].running():
                raise HTTPException(409, "Stop the Facebook sender before selecting another show")
            try:
                return await asyncio.to_thread(api.select, str(body.get("videoId", "")))
            except FacebookError as error:
                raise HTTPException(409, str(error)) from None

    @app.post("/facebook/send", dependencies=[Depends(require_key)])
    async def send(body: dict):
        async with api.mutation_lock:
            if not state.armed or not obs_state.get("program_ready"):
                raise HTTPException(409, "Arm the house and check the program preview first")
            meta = await asyncio.to_thread(api.refresh)
            if not state.armed or not obs_state.get("program_ready"):
                raise HTTPException(409, "The house stopped while Facebook was being checked")
            allowed_phase = meta.get("phase") == "UNPUBLISHED" or (
                meta.get("phase") == "LIVE" and body.get("confirmLive") == meta.get("videoId"))
            if body.get("videoId") != meta.get("videoId") or not allowed_phase or not api.target():
                raise HTTPException(409, "Select a verified unpublished Facebook preview before sending")
            # Only this action can enable Facebook. Publishing is manual in Live Producer.
            state.destinations["facebook"] = True
            state.save()
            return status_payload()

    @app.on_event("startup")
    async def start():
        async def watch():
            while True:
                try:
                    await asyncio.to_thread(api.refresh)
                    if not api.target() and state.destinations.get("facebook"):
                        state.destinations["facebook"] = False
                        pushers["facebook"].stop()
                        state.save()
                except Exception:
                    api.meta.update(verified=False, error="Facebook status unavailable")
                await asyncio.sleep(15)
        asyncio.create_task(watch())
