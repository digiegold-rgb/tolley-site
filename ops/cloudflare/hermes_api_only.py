#!/usr/bin/env python3
"""Run the existing Hermes API adapter without messaging adapters or cron."""
import asyncio
import os
import signal
import sys

sys.path.insert(0, "/home/jelly/.hermes")
from dotenv import load_dotenv
load_dotenv("/home/jelly/.hermes/.env")
from gateway.config import load_gateway_config, Platform
from gateway.run import GatewayRunner


async def main():
    config = load_gateway_config()
    api = config.platforms.get(Platform.API_SERVER)
    if not api or not api.extra.get("key"):
        raise RuntimeError("Authenticated Hermes API is not configured")
    api.enabled = True
    api.extra["host"] = "127.0.0.1"
    config.platforms = {Platform.API_SERVER: api}
    runner = GatewayRunner(config)
    stopped = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stopped.set)
    if not await runner.start():
        raise RuntimeError("Hermes API did not start")
    await stopped.wait()
    await runner.stop()


if __name__ == "__main__":
    asyncio.run(main())
