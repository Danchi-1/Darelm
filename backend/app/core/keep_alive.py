import os
import random
import asyncio
import logging
import urllib.request
import urllib.error
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

# Varied endpoints to ping (mix of 200, 401, 404) to look like organic traffic
PING_ENDPOINTS = [
    "/health",
    "/",
    "/docs",
    "/api/openapi.json",
    "/api/v1/auth/me",
    "/api/v1/datasets",
    "/api/v1/users",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/status",
    "/ping",
    "/api/version",
    "/static/logo.png",
    "/assets/index.js",
]

def _send_ping(url: str) -> Optional[int]:
    """
    Sends an HTTP GET request with realistic user headers to register traffic on Render's proxy.
    Returns HTTP status code (including 404, 401, etc.), which successfully resets Render's idle timer.
    """
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
    except urllib.error.HTTPError as e:
        # HTTP errors (404, 401, 403, etc.) still hit Render's reverse proxy and prevent spindown
        return e.code
    except Exception as e:
        logger.warning(f"[Keep-Alive] Ping network error: {e}")
        return None

async def start_keep_alive():
    """
    Randomized keep-alive routine for Render web services.
    Render free tier spins down after 15 minutes of inactivity.
    This routine picks a pseudo-random interval between 1 and 14 minutes,
    selects a randomized endpoint (even ones that return 404 or 401),
    waits for the time to elapse, and sends an external ping to keep the service
    warm and unsuspicious.
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
    
    logger.info(f"[Keep-Alive] Initialized. Base URL: {base_url}")

    # Initial brief warm-up delay before the first cycle
    await asyncio.sleep(15)

    while True:
        # Pick random minutes between 1 and 14, plus random jitter seconds
        random_minutes = random.randint(1, 14)
        random_seconds = random.randint(0, 59)
        total_delay = (random_minutes * 60) + random_seconds

        # Pick a random endpoint each time (varied paths, status 200/401/404)
        endpoint = random.choice(PING_ENDPOINTS)
        target_url = f"{base_url}{endpoint}"

        logger.info(f"[Keep-Alive] Next ping scheduled in {random_minutes}m {random_seconds}s to '{endpoint}' (total: {total_delay}s)")

        try:
            await asyncio.sleep(total_delay)
            status = await asyncio.to_thread(_send_ping, target_url)
            if status is not None:
                logger.info(f"[Keep-Alive] Heartbeat ping to '{endpoint}' completed -> HTTP {status} (traffic registered)")
        except asyncio.CancelledError:
            logger.info("[Keep-Alive] Service shutdown, terminating heartbeat task.")
            break
        except Exception as e:
            logger.warning(f"[Keep-Alive] Unexpected error in heartbeat loop: {e}")
