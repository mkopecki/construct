from __future__ import annotations

from typing import Any

from pydantic import BaseModel


# --- Request models ---

class CreateRecordingRequest(BaseModel):
    startUrl: str
    events: list[dict[str, Any]]


class UpdateSOPRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    steps: list[dict[str, Any]] | None = None
    variables: list[dict[str, Any]] | None = None
    output_schema: list[dict[str, Any]] | None = None


class StartRunRequest(BaseModel):
    sop_id: str
    params: dict[str, Any] = {}


class DataTarget(BaseModel):
    type: str
    enabled: bool = True


class SetDataTargetRequest(BaseModel):
    data_target: DataTarget | None = None


# --- Response models ---

class RecordingResponse(BaseModel):
    recording_id: str


class SOPSummary(BaseModel):
    id: str
    name: str
    description: str
    has_workflow: bool
    created_at: str
    updated_at: str


class SOPDetail(BaseModel):
    id: str
    name: str
    description: str
    recorded_events: list[dict[str, Any]]
    steps: list[dict[str, Any]]
    variables: list[dict[str, Any]]
    output_schema: list[dict[str, Any]]
    workspace_id: str | None
    workflow_md: str | None
    data_target: dict[str, Any] | None
    created_at: str
    updated_at: str


class RunSummary(BaseModel):
    id: str
    sop_id: str
    status: str
    current_step: int
    total_steps: int
    live_url: str | None
    started_at: str | None
    finished_at: str | None


class RunDetail(BaseModel):
    id: str
    sop_id: str
    params: dict[str, Any]
    status: str
    current_step: int
    total_steps: int
    step_results: list[dict[str, Any]]
    output: Any | None
    error: str | None
    session_id: str | None
    live_url: str | None
    cost_usd: float | None
    started_at: str | None
    finished_at: str | None
