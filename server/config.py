from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
BROWSER_USE_API_KEY: str = os.environ["BROWSER_USE_API_KEY"]
CONSTRUCT_DB: str = os.environ.get("CONSTRUCT_DB", "./data/construct.db")
HOST: str = os.environ.get("HOST", "0.0.0.0")
PORT: int = int(os.environ.get("PORT", "8000"))
WEB_UI_URL: str = os.environ.get("WEB_UI_URL", "http://localhost:5173")
