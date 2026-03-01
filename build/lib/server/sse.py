from __future__ import annotations

import json
from typing import Any


def sse_event(event_type: str, data: dict[str, Any] | None = None, **kwargs: Any) -> str:
    payload = {"type": event_type, **(data or {}), **kwargs}
    return f"data: {json.dumps(payload)}\n\n"
