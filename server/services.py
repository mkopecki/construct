from __future__ import annotations

import asyncio
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

import httpx

from server import config
from server.browser_use import BrowserUseClient
from server.db import get_db
from server.sse import sse_event
from server.workflow_md import build_run_task_prompt, build_workflow_md


class ConstructService:
    def __init__(self) -> None:
        self._bu = BrowserUseClient()

    # ---- SOP CRUD ----

    async def create_recording(self, start_url: str, events: list[dict[str, Any]]) -> str:
        sop_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()
        db = await get_db()
        try:
            await db.execute(
                "INSERT INTO sops (id, name, description, recorded_events, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                (sop_id, f"Recording {sop_id}", "", json.dumps(events), now, now),
            )
            await db.commit()
        finally:
            await db.close()
        return sop_id

    async def list_sops(self) -> list[dict[str, Any]]:
        db = await get_db()
        try:
            cursor = await db.execute(
                "SELECT id, name, description, workspace_id, created_at, updated_at FROM sops ORDER BY created_at DESC"
            )
            rows = await cursor.fetchall()
            return [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "description": r["description"],
                    "has_workflow": r["workspace_id"] is not None,
                    "created_at": r["created_at"],
                    "updated_at": r["updated_at"],
                }
                for r in rows
            ]
        finally:
            await db.close()

    async def get_sop(self, sop_id: str) -> dict[str, Any] | None:
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM sops WHERE id=?", (sop_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            raw_dt = row["data_target"]
            return {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "recorded_events": json.loads(row["recorded_events"]),
                "steps": json.loads(row["steps"]),
                "variables": json.loads(row["variables"]),
                "output_schema": json.loads(row["output_schema"]),
                "workspace_id": row["workspace_id"],
                "workflow_md": row["workflow_md"],
                "data_target": json.loads(raw_dt) if raw_dt else None,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        finally:
            await db.close()

    async def update_sop(self, sop_id: str, data: dict[str, Any]) -> bool:
        sets = []
        vals = []
        for field in ("name", "description", "steps", "variables", "output_schema"):
            if field in data and data[field] is not None:
                sets.append(f"{field}=?")
                val = data[field]
                vals.append(json.dumps(val) if isinstance(val, (list, dict)) else val)
        if not sets:
            return True
        now = datetime.now(timezone.utc).isoformat()
        sets.append("updated_at=?")
        vals.append(now)
        vals.append(sop_id)
        db = await get_db()
        try:
            cursor = await db.execute(
                f"UPDATE sops SET {', '.join(sets)} WHERE id=?", vals
            )
            await db.commit()
            return cursor.rowcount > 0
        finally:
            await db.close()

    async def delete_sop(self, sop_id: str) -> bool:
        db = await get_db()
        try:
            await db.execute("DELETE FROM runs WHERE sop_id=?", (sop_id,))
            cursor = await db.execute("DELETE FROM sops WHERE id=?", (sop_id,))
            await db.commit()
            return cursor.rowcount > 0
        finally:
            await db.close()

    async def set_data_target(self, sop_id: str, data_target: dict[str, Any] | None) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        db = await get_db()
        try:
            cursor = await db.execute(
                "UPDATE sops SET data_target=?, updated_at=? WHERE id=?",
                (json.dumps(data_target) if data_target else None, now, sop_id),
            )
            await db.commit()
            return cursor.rowcount > 0
        finally:
            await db.close()

    # ---- Workflow Generation (SSE) ----

    async def generate_workflow_stream(self, sop_id: str) -> AsyncGenerator[str, None]:
        sop = await self.get_sop(sop_id)
        if not sop:
            yield sse_event("error", message="SOP not found")
            return

        # Extract start URL from recorded events
        start_url = ""
        for ev in sop["recorded_events"]:
            if ev.get("type") == "navigate":
                start_url = ev.get("url", "")
                break

        yield sse_event("status", message="Creating cloud workspace...")

        try:
            # 1. Create workspace
            ws = await self._bu.create_workspace(sop["name"] or f"sop-{sop_id}")
            workspace_id = ws["id"]
            yield sse_event("status", message="Workspace created")

            # 2. Build workflow.md
            workflow_md = build_workflow_md(
                name=sop["name"],
                description=sop["description"],
                start_url=start_url,
                steps=sop["steps"],
                variables=sop["variables"],
                output_schema=sop["output_schema"],
            )
            yield sse_event("status", message="Workflow document built")

            # 3. Upload workflow.md to workspace
            await self._bu.upload_file(workspace_id, "workflow.md", workflow_md)
            yield sse_event("status", message="Uploaded workflow.md to workspace")

            # 4. Save to DB
            now = datetime.now(timezone.utc).isoformat()
            db = await get_db()
            try:
                await db.execute(
                    "UPDATE sops SET workspace_id=?, workflow_md=?, updated_at=? WHERE id=?",
                    (workspace_id, workflow_md, now, sop_id),
                )
                await db.commit()
            finally:
                await db.close()

            yield sse_event("complete", workspace_id=workspace_id)

        except Exception as exc:
            yield sse_event("error", message=str(exc))

    # ---- Workflow Execution (SSE) ----

    async def run_workflow_stream(
        self, sop_id: str, params: dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        sop = await self.get_sop(sop_id)
        if not sop:
            yield sse_event("error", message="SOP not found")
            return
        if not sop["workspace_id"]:
            yield sse_event("error", message="No generated workflow — generate first")
            return

        run_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()

        db = await get_db()
        try:
            await db.execute(
                "INSERT INTO runs (id, sop_id, params, status, started_at) VALUES (?,?,?,?,?)",
                (run_id, sop_id, json.dumps(params), "running", now),
            )
            await db.commit()
        finally:
            await db.close()

        try:
            # Build task prompt
            task = build_run_task_prompt(params, sop["output_schema"])

            # Create cloud session
            session = await self._bu.create_session(
                task=task, workspace_id=sop["workspace_id"]
            )
            session_id = session["id"]
            live_url = session.get("liveUrl")

            # Save session info to run
            db = await get_db()
            try:
                await db.execute(
                    "UPDATE runs SET session_id=?, live_url=? WHERE id=?",
                    (session_id, live_url, run_id),
                )
                await db.commit()
            finally:
                await db.close()

            yield sse_event("run_started", run_id=run_id, live_url=live_url)

            # Poll session until complete
            output, cost = await self._poll_session(session_id, sop)

            await self._finish_run(run_id, "passed", output=output, cost_usd=cost)
            yield sse_event("complete", run_id=run_id, output=output)

        except Exception as exc:
            await self._finish_run(run_id, "failed", error=str(exc))
            yield sse_event("error", message=str(exc))

    async def _poll_session(
        self,
        session_id: str,
        sop: dict[str, Any],
    ) -> tuple[Any, float | None]:
        """Poll BU Cloud session until it finishes. Returns (output, cost_usd)."""
        while True:
            await asyncio.sleep(2)
            session = await self._bu.get_session(session_id)
            status = session.get("status", "")

            if status == "stopped":
                raw = session.get("output", "") or ""
                output = _parse_agent_output(raw, sop["output_schema"])
                cost_str = session.get("totalCostUsd")
                cost = float(cost_str) if cost_str else None
                return output, cost
            elif status in ("error", "timed_out"):
                error = session.get("output") or f"Session {status}"
                raise RuntimeError(error)

    # ---- Run management (for MCP) ----

    async def start_run(self, sop_id: str, params: dict[str, Any]) -> str:
        """Fire-and-forget run for MCP — returns run_id immediately."""
        sop = await self.get_sop(sop_id)
        if not sop:
            raise ValueError("SOP not found")
        if not sop["workspace_id"]:
            raise ValueError("No generated workflow")

        run_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()

        db = await get_db()
        try:
            await db.execute(
                "INSERT INTO runs (id, sop_id, params, status, started_at) VALUES (?,?,?,?,?)",
                (run_id, sop_id, json.dumps(params), "running", now),
            )
            await db.commit()
        finally:
            await db.close()

        asyncio.create_task(self._execute_run_background(run_id, sop, params))
        return run_id

    async def _execute_run_background(
        self, run_id: str, sop: dict[str, Any], params: dict[str, Any]
    ) -> None:
        try:
            task = build_run_task_prompt(params, sop["output_schema"])
            session = await self._bu.create_session(
                task=task, workspace_id=sop["workspace_id"]
            )
            session_id = session["id"]
            live_url = session.get("liveUrl")

            db = await get_db()
            try:
                await db.execute(
                    "UPDATE runs SET session_id=?, live_url=? WHERE id=?",
                    (session_id, live_url, run_id),
                )
                await db.commit()
            finally:
                await db.close()

            output, cost = await self._poll_session(session_id, sop)
            await self._finish_run(run_id, "passed", output=output, cost_usd=cost)
        except Exception as exc:
            await self._finish_run(run_id, "failed", error=str(exc))

    async def get_run(self, run_id: str) -> dict[str, Any] | None:
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM runs WHERE id=?", (run_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "sop_id": row["sop_id"],
                "params": json.loads(row["params"]),
                "status": row["status"],
                "current_step": row["current_step"],
                "total_steps": row["total_steps"],
                "step_results": json.loads(row["step_results"]),
                "output": json.loads(row["output"]) if row["output"] else None,
                "error": row["error"],
                "session_id": row["session_id"],
                "live_url": row["live_url"],
                "cost_usd": row["cost_usd"],
                "started_at": row["started_at"],
                "finished_at": row["finished_at"],
            }
        finally:
            await db.close()

    async def list_runs(self, sop_id: str) -> list[dict[str, Any]]:
        db = await get_db()
        try:
            cursor = await db.execute(
                "SELECT id, sop_id, status, current_step, total_steps, live_url, started_at, finished_at FROM runs WHERE sop_id=? ORDER BY started_at DESC",
                (sop_id,),
            )
            rows = await cursor.fetchall()
            return [
                {
                    "id": r["id"],
                    "sop_id": r["sop_id"],
                    "status": r["status"],
                    "current_step": r["current_step"],
                    "total_steps": r["total_steps"],
                    "live_url": r["live_url"],
                    "started_at": r["started_at"],
                    "finished_at": r["finished_at"],
                }
                for r in rows
            ]
        finally:
            await db.close()

    async def cancel_run(self, run_id: str) -> bool:
        run = await self.get_run(run_id)
        if not run or not run.get("session_id"):
            return False
        try:
            await self._bu.stop_session(run["session_id"])
            await self._finish_run(run_id, "cancelled")
            return True
        except Exception:
            return False

    # ---- Helpers ----

    async def _finish_run(
        self,
        run_id: str,
        status: str,
        output: Any = None,
        error: str | None = None,
        cost_usd: float | None = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        db = await get_db()
        try:
            await db.execute(
                "UPDATE runs SET status=?, output=?, error=?, cost_usd=?, finished_at=? WHERE id=?",
                (
                    status,
                    json.dumps(output) if output else None,
                    error,
                    cost_usd,
                    now,
                    run_id,
                ),
            )
            await db.commit()
        finally:
            await db.close()

        if status in ("passed", "failed"):
            await self._send_data_target_notification(
                run_id, status, output=output, error=error, cost_usd=cost_usd
            )

    async def _send_data_target_notification(
        self,
        run_id: str,
        status: str,
        output: Any = None,
        error: str | None = None,
        cost_usd: float | None = None,
    ) -> None:
        try:
            # Look up the run's SOP to get data_target
            run = await self.get_run(run_id)
            if not run:
                return
            sop = await self.get_sop(run["sop_id"])
            if not sop or not sop.get("data_target"):
                return
            dt = sop["data_target"]
            if not dt.get("enabled"):
                return
            if dt.get("type") == "discord_webhook":
                await self._send_discord_notification(
                    sop_name=sop["name"],
                    run_id=run_id,
                    status=status,
                    output=output,
                    error=error,
                    cost_usd=cost_usd,
                )
        except Exception:
            pass  # never break run finalization

    async def _send_discord_notification(
        self,
        sop_name: str,
        run_id: str,
        status: str,
        output: Any = None,
        error: str | None = None,
        cost_usd: float | None = None,
    ) -> None:
        url = config.DISCORD_WEBHOOK_URL
        if not url:
            return

        color = 0x22C55E if status == "passed" else 0xEF4444
        fields = [
            {"name": "Run ID", "value": f"`{run_id}`", "inline": True},
            {"name": "Status", "value": status.upper(), "inline": True},
        ]
        if cost_usd is not None:
            fields.append({"name": "Cost", "value": f"${cost_usd:.4f}", "inline": True})
        if output:
            val = json.dumps(output, indent=2)
            if len(val) > 1000:
                val = val[:997] + "..."
            fields.append({"name": "Output", "value": f"```json\n{val}\n```", "inline": False})
        if error:
            err_val = error if len(error) <= 1000 else error[:997] + "..."
            fields.append({"name": "Error", "value": f"```\n{err_val}\n```", "inline": False})

        payload = {
            "embeds": [
                {
                    "title": f"Workflow Run — {sop_name}",
                    "color": color,
                    "fields": fields,
                }
            ]
        }
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=10)


def _parse_agent_output(
    raw: str, output_schema: list[dict[str, Any]]
) -> dict[str, Any] | None:
    """Extract JSON from the agent's free-text output."""
    if not output_schema:
        return None

    # Try fenced code block first
    m = re.search(r"```json\s*\n(.*?)\n\s*```", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # Try raw JSON object
    m = re.search(r"\{[^{}]*\}", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass

    # Fallback: extract values from prose using field names
    result: dict[str, Any] = {}
    for field in output_schema:
        name = field["name"]
        ftype = field.get("type", "string")
        if ftype in ("number", "integer"):
            # Look for patterns like "price is $99.00" or "price: 99"
            pattern = rf'(?:{re.escape(name)}[^0-9$]*[\$]?\s*)([\d,]+\.?\d*)'
            m = re.search(pattern, raw, re.IGNORECASE)
            if not m:
                # Try any dollar amount or number near the field context
                m = re.search(r'\$\s*([\d,]+\.?\d*)', raw)
            if m:
                val = m.group(1).replace(",", "")
                result[name] = int(val) if ftype == "integer" else float(val)
        elif ftype == "boolean":
            pattern = rf'{re.escape(name)}\s*[:=]?\s*(true|false|yes|no)'
            m = re.search(pattern, raw, re.IGNORECASE)
            if m:
                result[name] = m.group(1).lower() in ("true", "yes")
        else:
            # String: look for "field: value" or "field is value"
            pattern = rf'{re.escape(name)}\s*(?:is|:)\s*["\']?([^"\'\n,]+)'
            m = re.search(pattern, raw, re.IGNORECASE)
            if m:
                result[name] = m.group(1).strip()

    return result if result else None
