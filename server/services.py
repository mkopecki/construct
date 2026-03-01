from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from pydantic import create_model

from server import config
from server.db import get_db
from server.prompt import build_generation_prompt
from server.sse import sse_event


class ConstructService:
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
                "SELECT id, name, description, workflow_json, created_at, updated_at FROM sops ORDER BY created_at DESC"
            )
            rows = await cursor.fetchall()
            return [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "description": r["description"],
                    "has_workflow": r["workflow_json"] is not None,
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
            return {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "recorded_events": json.loads(row["recorded_events"]),
                "steps": json.loads(row["steps"]),
                "variables": json.loads(row["variables"]),
                "output_schema": json.loads(row["output_schema"]),
                "workflow_json": json.loads(row["workflow_json"]) if row["workflow_json"] else None,
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

        prompt = build_generation_prompt(
            name=sop["name"],
            description=sop["description"],
            start_url=start_url,
            steps=sop["steps"],
            variables=sop["variables"],
            output_schema=sop["output_schema"],
        )

        yield sse_event("status", message="Starting workflow generation...")

        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

        def on_step_recorded(step_data: dict[str, Any]) -> None:
            queue.put_nowait({"type": "step", **step_data})

        def on_status_update(message: str) -> None:
            queue.put_nowait({"type": "status", "message": message})

        async def _generate() -> Any:
            from browser_use.llm.openai.chat import ChatOpenAI

            from workflow_use.healing.service import HealingService

            llm = ChatOpenAI(model=config.OPENAI_MODEL, api_key=config.OPENAI_API_KEY)
            service = HealingService(llm, use_deterministic_conversion=True)
            result = await service.generate_workflow_from_prompt(
                prompt=prompt,
                agent_llm=llm,
                extraction_llm=llm,
                use_cloud=True,
                on_step_recorded=on_step_recorded,
                on_status_update=on_status_update,
            )
            return result

        task = asyncio.create_task(_generate())

        try:
            while not task.done():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield sse_event(event.pop("type"), **event)
                except asyncio.TimeoutError:
                    continue

            # Drain remaining events
            while not queue.empty():
                event = await asyncio.wait_for(queue.get(), timeout=0.1)
                yield sse_event(event.pop("type"), **event)

            workflow_schema = await task
            workflow_dict = workflow_schema.model_dump()

            # Save to DB
            now = datetime.now(timezone.utc).isoformat()
            db = await get_db()
            try:
                await db.execute(
                    "UPDATE sops SET workflow_json=?, updated_at=? WHERE id=?",
                    (json.dumps(workflow_dict), now, sop_id),
                )
                await db.commit()
            finally:
                await db.close()

            yield sse_event("complete", workflow=workflow_dict)

        except Exception as exc:
            if not task.done():
                task.cancel()
            yield sse_event("error", message=str(exc))

    # ---- Workflow Execution (SSE) ----

    async def run_workflow_stream(
        self, sop_id: str, params: dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        sop = await self.get_sop(sop_id)
        if not sop:
            yield sse_event("error", message="SOP not found")
            return
        if not sop["workflow_json"]:
            yield sse_event("error", message="No generated workflow — generate first")
            return

        run_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()
        workflow_data = sop["workflow_json"]
        total_steps = len(workflow_data.get("steps", []))

        db = await get_db()
        try:
            await db.execute(
                "INSERT INTO runs (id, sop_id, params, status, total_steps, started_at) VALUES (?,?,?,?,?,?)",
                (run_id, sop_id, json.dumps(params), "running", total_steps, now),
            )
            await db.commit()
        finally:
            await db.close()

        yield sse_event("run_started", run_id=run_id, total_steps=total_steps)

        cancel_event = asyncio.Event()
        self._active_runs = getattr(self, "_active_runs", {})
        self._active_runs[run_id] = cancel_event

        try:
            from browser_use.llm.openai.chat import ChatOpenAI

            from workflow_use.schema.views import WorkflowDefinitionSchema
            from workflow_use.workflow.service import Workflow

            llm = ChatOpenAI(model=config.OPENAI_MODEL, api_key=config.OPENAI_API_KEY)
            schema = WorkflowDefinitionSchema(**workflow_data)

            output_model = self._build_output_model(sop["output_schema"])
            self._ensure_extraction_step(schema, sop["output_schema"])
            self._convert_extraction_steps(schema)
            total_steps = len(schema.steps)

            workflow = Workflow(schema, llm, use_cloud=True)

            yield sse_event("status", message="Executing workflow on cloud browser...")

            result = await workflow.run_with_no_ai(
                inputs=params,
                output_model=output_model,
                cancel_event=cancel_event,
                close_browser_at_end=True,
            )
            output = result.output_model.model_dump() if result.output_model else None
            await self._finish_run(run_id, "passed", [], current_step=total_steps, output=output)
            yield sse_event("complete", run_id=run_id, output=output)

        except Exception as exc:
            await self._finish_run(run_id, "failed", [], error=str(exc))
            yield sse_event("error", message=str(exc))
        finally:
            self._active_runs.pop(run_id, None)

    # ---- Run management (for MCP) ----

    async def start_run(self, sop_id: str, params: dict[str, Any]) -> str:
        """Fire-and-forget run for MCP — returns run_id immediately."""
        sop = await self.get_sop(sop_id)
        if not sop:
            raise ValueError("SOP not found")
        if not sop["workflow_json"]:
            raise ValueError("No generated workflow")

        run_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()
        total_steps = len(sop["workflow_json"].get("steps", []))

        db = await get_db()
        try:
            await db.execute(
                "INSERT INTO runs (id, sop_id, params, status, total_steps, started_at) VALUES (?,?,?,?,?,?)",
                (run_id, sop_id, json.dumps(params), "running", total_steps, now),
            )
            await db.commit()
        finally:
            await db.close()

        cancel_event = asyncio.Event()
        self._active_runs = getattr(self, "_active_runs", {})
        self._active_runs[run_id] = cancel_event

        asyncio.create_task(self._execute_run_background(run_id, sop, params, cancel_event))
        return run_id

    async def _execute_run_background(
        self, run_id: str, sop: dict[str, Any], params: dict[str, Any], cancel_event: asyncio.Event
    ) -> None:
        try:
            from browser_use.llm.openai.chat import ChatOpenAI

            from workflow_use.schema.views import WorkflowDefinitionSchema
            from workflow_use.workflow.service import Workflow

            llm = ChatOpenAI(model=config.OPENAI_MODEL, api_key=config.OPENAI_API_KEY)
            schema = WorkflowDefinitionSchema(**sop["workflow_json"])

            output_model = self._build_output_model(sop["output_schema"])
            self._ensure_extraction_step(schema, sop["output_schema"])
            self._convert_extraction_steps(schema)

            workflow = Workflow(schema, llm, use_cloud=True)

            result = await workflow.run_with_no_ai(
                inputs=params,
                output_model=output_model,
                cancel_event=cancel_event,
                close_browser_at_end=True,
            )
            output = result.output_model.model_dump() if result.output_model else None
            await self._finish_run(run_id, "passed", [], current_step=len(schema.steps), output=output)
        except Exception as exc:
            await self._finish_run(run_id, "failed", [], error=str(exc))
        finally:
            self._active_runs.pop(run_id, None)

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
                "started_at": row["started_at"],
                "finished_at": row["finished_at"],
            }
        finally:
            await db.close()

    async def list_runs(self, sop_id: str) -> list[dict[str, Any]]:
        db = await get_db()
        try:
            cursor = await db.execute(
                "SELECT id, sop_id, status, current_step, total_steps, started_at, finished_at FROM runs WHERE sop_id=? ORDER BY started_at DESC",
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
                    "started_at": r["started_at"],
                    "finished_at": r["finished_at"],
                }
                for r in rows
            ]
        finally:
            await db.close()

    async def cancel_run(self, run_id: str) -> bool:
        active = getattr(self, "_active_runs", {})
        event = active.get(run_id)
        if event:
            event.set()
            return True
        return False

    # ---- Helpers ----

    async def _update_run_progress(
        self, run_id: str, current_step: int, step_results: list[dict[str, Any]]
    ) -> None:
        db = await get_db()
        try:
            await db.execute(
                "UPDATE runs SET current_step=?, step_results=? WHERE id=?",
                (current_step, json.dumps(step_results), run_id),
            )
            await db.commit()
        finally:
            await db.close()

    async def _finish_run(
        self,
        run_id: str,
        status: str,
        step_results: list[dict[str, Any]],
        current_step: int = 0,
        output: Any = None,
        error: str | None = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        db = await get_db()
        try:
            await db.execute(
                "UPDATE runs SET status=?, current_step=?, step_results=?, output=?, error=?, finished_at=? WHERE id=?",
                (status, current_step, json.dumps(step_results), json.dumps(output) if output else None, error, now, run_id),
            )
            await db.commit()
        finally:
            await db.close()

    @staticmethod
    def _ensure_extraction_step(schema, output_schema: list[dict[str, Any]]) -> None:
        from workflow_use.schema.views import PageExtractionStep

        if not output_schema:
            return
        steps = schema.steps
        if steps and steps[-1].type in ("extract", "extract_page_content"):
            return
        field_names = [f["name"] for f in output_schema]
        schema.steps.append(PageExtractionStep(
            type="extract_page_content",
            goal=f"Extract the following data: {', '.join(field_names)}",
            description="Extract output data",
        ))

    @staticmethod
    def _convert_extraction_steps(schema) -> None:
        """Convert PageExtractionStep to ExtractStep so the semantic executor can handle them."""
        from workflow_use.schema.views import ExtractStep, PageExtractionStep

        for i, step in enumerate(schema.steps):
            if isinstance(step, PageExtractionStep):
                schema.steps[i] = ExtractStep(
                    type="extract",
                    extractionGoal=step.goal,
                    description=getattr(step, "description", ""),
                )

    @staticmethod
    def _build_output_model(output_schema: list[dict[str, Any]]) -> type | None:
        if not output_schema:
            return None
        fields: dict[str, Any] = {}
        type_map = {"string": str, "number": float, "integer": int, "boolean": bool}
        for field in output_schema:
            py_type = type_map.get(field.get("type", "string"), str)
            fields[field["name"]] = (py_type, ...)
        return create_model("DynamicOutput", **fields)
