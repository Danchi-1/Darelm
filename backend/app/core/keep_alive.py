import os
import random
import asyncio
import logging
import urllib.request
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("darelm.keep_alive")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
]

def _send_ping(url: str) -> Optional[int]:
    """Sends an HTTP GET request with realistic user headers."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": random.choice(USER_AGENTS),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status
    except Exception as e:
        logger.warning(f"[Keep-Alive] Ping request failed: {e}")
        return None

async def start_keep_alive():
    """
    Randomized keep-alive routine for Render web services.
    Render free tier spins down after 15 minutes of inactivity.
    This routine picks a pseudo-random interval between 1 and 14 minutes,
    waits for it, and sends an external ping to keep the service warm and
    prevent suspicion.
    """
    if not settings.ENABLE_KEEP_ALIVE:
        logger.info("[Keep-Alive] Disabled via settings.")
        return

    # Determine external service URL (Render auto-injects RENDER_EXTERNAL_URL)
    base_url = (
        os.getenv("RENDER_EXTERNAL_URL")
        or settings.RENDER_EXTERNAL_URL
        or "https://darelm.onrender.com"
    ).rstrip("/")
    
    target_url = f"{base_url}/health"
    logger.info(f"[Keep-Alive] Initialized. Target URL: {target_url}")

    # Initial brief warm-up delay before the first cycle
    await asyncio.sleep(15)

    while True:
        # Pick random minutes between 1 and 14, plus random jitter seconds
        random_minutes = random.randint(1, 14)
        random_seconds = random.randint(0, 59)
        total_delay = (random_minutes * 60) + random_seconds

        logger.info(f"[Keep-Alive] Next ping scheduled in {random_minutes}m {random_seconds}s (total: {total_delay}s)")

        try:
            await asyncio.sleep(total_delay)
            status = await asyncio.to_thread(_send_ping, target_url)
            if status:
                logger.info(f"[Keep-Alive] Heartbeat ping successful -> HTTP {status}")
        except asyncio.CancelledError:
            logger.info("[Keep-Alive] Service shutdown, terminating heartbeat task.")
            break
        except Exception as e:
            logger.warning(f"[Keep-Alive] Unexpected error in heartbeat loop: {e}")
