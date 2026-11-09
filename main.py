from __future__ import annotations

import asyncio
import logging
import os
from contextlib import suppress
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from mrkt_bot.config import load_settings
from mrkt_bot.logging_config import configure_logging, print_boot
from mrkt_bot.mini_app import create_app as create_mini_app
from mrkt_bot.rate_limiter import get_limiter
from mrkt_bot.storage import SessionStore

STATIC_DIR = Path(__file__).parent / "static"

print_boot("website process starting")
configure_logging()
log = logging.getLogger("website")

app = FastAPI(title="MRKT Web Auth", docs_url=None, redoc_url=None, openapi_url=None)

limiter = get_limiter()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

settings = load_settings()
log.info(
    "[boot] website config loaded token_set=%s storage=%s mini_app_url=%s",
    bool(settings.bot_token),
    settings.storage_path,
    settings.mini_app_url or "-",
)
store = SessionStore(settings.storage_path)

# Reuse the existing Mini App backend (same OAuth + encryption)
mini_app = create_mini_app(settings, store, telegram_bot=None)

@app.get("/")
async def index():
    if (STATIC_DIR / "index.html").exists():
        return FileResponse(STATIC_DIR / "index.html")
    return HTMLResponse(
        "<h1>MRKT Web</h1><p>Откройте Telegram бота или используйте Mini App.</p>"
    )

@app.get("/health")
async def health():
    return {"ok": True}

# Mount the same auth endpoints under /auth
app.mount("/auth", mini_app)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    log.info("[website] uvicorn starting host=0.0.0.0 port=%s", port)
    uvicorn.run(app, host="0.0.0.0", port=port, proxy_headers=True, forwarded_allow_ips="*", log_config=None)