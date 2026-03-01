"""HTTP client for Browser Use Cloud API v3."""

from __future__ import annotations

from typing import Any

import httpx

from server import config


class BrowserUseClient:
    def __init__(self) -> None:
        self._base = config.BROWSER_USE_API_URL.rstrip("/")
        self._headers = {"X-Browser-Use-API-Key": config.BROWSER_USE_API_KEY}

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base,
            headers=self._headers,
            timeout=30.0,
        )

    async def create_workspace(self, name: str) -> dict[str, Any]:
        async with self._client() as c:
            r = await c.post("/api/v3/workspaces", json={"name": name})
            r.raise_for_status()
            return r.json()

    async def upload_file(
        self, workspace_id: str, filename: str, content: str, content_type: str = "text/markdown"
    ) -> dict[str, Any]:
        encoded = content.encode()
        async with self._client() as c:
            # Get presigned upload URL
            r = await c.post(
                f"/api/v3/workspaces/{workspace_id}/files/upload",
                json={"files": [{"name": filename, "contentType": content_type, "size": len(encoded)}]},
            )
            r.raise_for_status()
            upload_info = r.json()

            # Response is a list of {name, uploadUrl, path}
            files = upload_info if isinstance(upload_info, list) else upload_info.get("files", [upload_info])
            upload_url = files[0]["uploadUrl"]
            async with httpx.AsyncClient(timeout=30.0) as raw:
                put = await raw.put(
                    upload_url,
                    content=encoded,
                    headers={"Content-Type": content_type},
                )
                put.raise_for_status()

            return upload_info

    async def create_session(
        self,
        task: str,
        workspace_id: str | None = None,
        model: str = "bu-mini",
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"task": task, "model": model}
        if workspace_id:
            body["workspace_id"] = workspace_id
        async with self._client() as c:
            r = await c.post("/api/v3/sessions", json=body)
            r.raise_for_status()
            return r.json()

    async def get_session(self, session_id: str) -> dict[str, Any]:
        async with self._client() as c:
            r = await c.get(f"/api/v3/sessions/{session_id}")
            r.raise_for_status()
            return r.json()

    async def stop_session(self, session_id: str) -> dict[str, Any]:
        async with self._client() as c:
            r = await c.put(f"/api/v3/sessions/{session_id}/stop")
            r.raise_for_status()
            return r.json()
