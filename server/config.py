from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

BROWSER_USE_API_KEY: str = os.environ["BROWSER_USE_API_KEY"]
BROWSER_USE_API_URL: str = os.environ.get("BROWSER_USE_API_URL", "https://api.browser-use.com")
CONSTRUCT_DB: str = os.environ.get("CONSTRUCT_DB", "./data/construct.db")
HOST: str = os.environ.get("HOST", "0.0.0.0")
PORT: int = int(os.environ.get("PORT", "8000"))
WEB_UI_URL: str = os.environ.get("WEB_UI_URL", "http://localhost:5173")
DISCORD_WEBHOOK_URL: str | None = os.environ.get("DISCORD_WEBHOOK_URL")
