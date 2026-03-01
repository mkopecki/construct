from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from server.models import (
    CreateRecordingRequest,
    RecordingResponse,
    StartRunRequest,
    UpdateSOPRequest,
)
from server.services import ConstructService

router = APIRouter(prefix="/api")
service = ConstructService()


@router.post("/recordings", response_model=RecordingResponse)
async def create_recording(req: CreateRecordingRequest):
    sop_id = await service.create_recording(req.startUrl, req.events)
    return RecordingResponse(recording_id=sop_id)


@router.get("/sops")
async def list_sops():
    return await service.list_sops()


@router.get("/sops/{sop_id}")
async def get_sop(sop_id: str):
    sop = await service.get_sop(sop_id)
    if not sop:
        raise HTTPException(404, "SOP not found")
    return sop


@router.patch("/sops/{sop_id}")
async def update_sop(sop_id: str, req: UpdateSOPRequest):
    updated = await service.update_sop(sop_id, req.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(404, "SOP not found")
    return {"ok": True}


@router.delete("/sops/{sop_id}")
async def delete_sop(sop_id: str):
    deleted = await service.delete_sop(sop_id)
    if not deleted:
        raise HTTPException(404, "SOP not found")
    return {"ok": True}


@router.post("/sops/{sop_id}/generate")
async def generate_workflow(sop_id: str):
    return StreamingResponse(
        service.generate_workflow_stream(sop_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/runs")
async def start_run(req: StartRunRequest):
    return StreamingResponse(
        service.run_workflow_stream(req.sop_id, req.params),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    run = await service.get_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    return run


@router.get("/sops/{sop_id}/runs")
async def list_runs(sop_id: str):
    return await service.list_runs(sop_id)


@router.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str):
    cancelled = await service.cancel_run(run_id)
    if not cancelled:
        raise HTTPException(404, "Run not active")
    return {"ok": True}
