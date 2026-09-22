#!/usr/bin/env python3
"""stream_chat — merges YouTube + TikTok live chat into one feed for tolley.io/stream.

YouTube: owner-verified live discovery via Data API; chat-downloader for chat.
TikTok:  TikTokLive (unofficial webcast client) on CHAT_TIKTOK_USER while that account is live.
Serves GET /chat?since=<id> on 127.0.0.1:8099 (the director proxies it with auth).
"""
from __future__ import annotations

import asyncio
import itertools
import json
import logging
import re
import threading
import time
from collections import deque
from pathlib import Path

import httpx
from source_metadata import youtube_page
from youtube_metrics import YouTubeLive
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

LOG = logging.getLogger("chat")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
for noisy in ("httpx", "chat_downloader", "TikTokLive", "websockets"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

ENV_PATH = Path.home() / ".config/tolley-security/stream.env"
ENV: dict[str, str] = {}
for line in ENV_PATH.read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        ENV[k.strip()] = v.strip()

TT_USER = ENV.get("CHAT_TIKTOK_USER", "digiegold").lstrip("@")

TT_OWNER = TT_USER
ACTIVE_TT = None
SEQ = itertools.count(1)
MSGS: deque[dict] = deque(maxlen=2000)
STATE = {"youtube": {"connected": False, "video": "", "override": "", "error": ""},
         "tiktok": {"connected": False, "user": TT_USER, "error": "", "viewers": None}}
LOCK = threading.Lock()


def push(platform: str, user: str, text: str, kind: str = "chat", extra: dict | None = None) -> None:
    with LOCK:
        MSGS.append({"id": next(SEQ), "t": int(time.time()), "p": platform, "u": (user or "?")[:40], "m": (text or "")[:400], "k": kind, **(extra or {})})


# ── YouTube ─────────────────────────────────────────────────────────────
def yt_status_worker() -> None:
    api=YouTubeLive()
    while True:
        override=STATE["youtube"]["override"]
        try:
            meta=api.status(override)
        except Exception:
            try:
                target=override or "https://www.youtube.com/channel/UCd4bJKIvbGOIAT-GK4K-3_w/live"
                r=httpx.get(target,follow_redirects=True,timeout=15,headers={"User-Agent":"Mozilla/5.0","Accept-Language":"en-US"})
                r.raise_for_status();meta=youtube_page(r.text)
                meta['error']='' if meta.get('verified') else 'Could not verify the live video'
            except Exception:meta={'liveNow':None,'verified':False,'error':'Could not verify the live video'}
        with LOCK:
            if override==STATE["youtube"]["override"]:
                STATE["youtube"].update(meta,checkedAt=time.time())
                if meta.get("liveNow") is not True:STATE["youtube"]["connected"]=False
        time.sleep(45)


def yt_worker() -> None:
    from chat_downloader import ChatDownloader
    while True:
        meta=dict(STATE["youtube"])
        target=meta.get("video") if meta.get("liveNow") is True and meta.get("verified") and time.time()-meta.get("checkedAt",0)<90 else None
        if not target:
            STATE["youtube"]["connected"]=False
            time.sleep(5)
            continue
        STATE["youtube"].update(error="")
        try:
            LOG.info("youtube chat: %s", target)
            chat = ChatDownloader().get_chat(target, message_groups=["messages", "superchat"], timeout=60)
            STATE["youtube"]["connected"] = True
            for m in chat:
                if STATE["youtube"].get("video")!=target or STATE["youtube"].get("liveNow") is not True:break
                name = (m.get("author") or {}).get("name", "?")
                text = m.get("message") or ""
                kind = "gift" if "paid" in (m.get("message_type") or "") or m.get("money") else "chat"
                extra={"source":target,"eventId":str(m.get("message_id") or ""),"userId":str((m.get("author") or {}).get("id") or "")}
                if kind=="gift":extra["amt"]=(m.get("money") or {}).get("text", "")
                push("yt", name, text, kind, extra)
        except Exception as e:
            STATE["youtube"].update(connected=False, error=str(e)[:120])
            LOG.warning("youtube chat ended: %s", str(e)[:120])
        STATE["youtube"]["connected"] = False
        time.sleep(10)


# ── TikTok ──────────────────────────────────────────────────────────────
async def tt_loop() -> None:
    global ACTIVE_TT
    from TikTokLive import TikTokLiveClient
    from TikTokLive.events import CommentEvent, ConnectEvent, DisconnectEvent, GiftEvent, JoinEvent, LikeEvent, RoomUserSeqEvent
    while True:
        current_user=TT_USER
        client = TikTokLiveClient(unique_id=f"@{current_user}")
        ACTIVE_TT=client
        source=""
        def identity(e):
            return {"source":source,"eventId":str(getattr(getattr(e,"common",None),"msg_id","") or ""),"userId":str(getattr(e.user,"id","") or "")}

        @client.on(ConnectEvent)
        async def _c(e):
            nonlocal source
            source=f"tiktok:{current_user}:{e.room_id}"
            STATE["tiktok"].update(connected=True, error="", user=current_user, source=source, roomId=str(e.room_id), viewers=None, viewersAt=None, verified=current_user==TT_OWNER,liveNow=True,checkedAt=time.time())
            LOG.info("tiktok connected to @%s", TT_USER)

        @client.on(DisconnectEvent)
        async def _d(e):
            STATE["tiktok"].update(connected=False, liveNow=None, checkedAt=time.time())

        @client.on(CommentEvent)
        async def _m(e):
            push("tt", getattr(e.user, "nickname", None) or getattr(e.user, "unique_id", "?"), e.comment, extra=identity(e))

        @client.on(GiftEvent)
        async def _g(e):
            try:
                if e.gift.streakable and e.streaking:
                    return  # wait for the streak to finish
                push("tt", getattr(e.user, "nickname", None) or "?", f"sent {e.gift.name} x{e.repeat_count}", "gift",
                     {**identity(e),"amt": f"{(e.gift.diamond_count or 0) * e.repeat_count} 💎"})
            except Exception:
                push("tt", getattr(e.user, "nickname", None) or "?", "sent a gift", "gift", identity(e))

        @client.on(JoinEvent)
        async def _j(e):
            push("tt", getattr(e.user, "nickname", None) or "?", "joined", "join", identity(e))

        @client.on(RoomUserSeqEvent)
        async def _v(e):
            value=getattr(e,"total",None)
            if type(value) is int and value>=0:
                STATE["tiktok"].update(viewers=value,viewersAt=time.time(),checkedAt=time.time())

        try:
            if not await client.is_live():
                STATE["tiktok"].update(connected=False, liveNow=False, verified=current_user==TT_OWNER,checkedAt=time.time(),error="")
                await asyncio.sleep(20)
                continue
            await client.connect()
        except Exception as e:
            STATE["tiktok"].update(connected=False,liveNow=None,verified=False,checkedAt=time.time(),error=str(e)[:120])
            LOG.warning("tiktok: %s", str(e)[:120])
            await asyncio.sleep(15)
        STATE["tiktok"]["connected"] = False
        await asyncio.sleep(5)


# ── HTTP ────────────────────────────────────────────────────────────────
app = FastAPI(docs_url=None, redoc_url=None)


@app.get("/chat")
async def chat(since: int = 0, limit: int = 80) -> JSONResponse:
    with LOCK:
        limit=max(1,min(limit,2000))
        items = [m for m in MSGS if m["id"] > since][-limit:]
        last = MSGS[-1]["id"] if MSGS else 0
    return JSONResponse({"items": items, "last": last, "youtube": STATE["youtube"], "tiktok": STATE["tiktok"]})


@app.post("/chat/tiktok")
async def set_tiktok(request: Request) -> JSONResponse:
    """Change the TikTok account to follow (the live loop picks it up on its next retry)."""
    global TT_USER
    body = await request.json()
    u = (body.get("user") or "").strip().lstrip("@").split("/")[-1]
    if u:
        TT_USER = u
        STATE["tiktok"].update(user=u, connected=False, verified=False, liveNow=None, source="", viewers=None, viewersAt=None, error="")
        if ACTIVE_TT:
            await ACTIVE_TT.disconnect()
    return JSONResponse({"ok": True, "user": TT_USER})


@app.post("/chat/youtube")
async def set_youtube(request: Request) -> JSONResponse:
    body = await request.json()
    url = (body.get("url") or "").strip()
    m = re.search(r"(?:v=|youtu\.be/|/live/)([A-Za-z0-9_-]{11})", url)
    STATE["youtube"]["override"] = f"https://www.youtube.com/watch?v={m.group(1)}" if m else ""
    return JSONResponse({"ok": True, "override": STATE["youtube"]["override"]})


@app.on_event("startup")
async def _start() -> None:
    threading.Thread(target=yt_status_worker, daemon=True).start()
    threading.Thread(target=yt_worker, daemon=True).start()
    asyncio.create_task(tt_loop())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8099, log_level="warning")
