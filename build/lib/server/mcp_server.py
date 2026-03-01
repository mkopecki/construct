"""MCP server for Construct — run with: python -m server.mcp_server"""

from __future__ import annotations

from typing import Any

from fastmcp import FastMCP

from server.services import ConstructService

mcp = FastMCP("Construct")
service = ConstructService()


@mcp.tool()
async def list_workflows() -> list[dict[str, Any]]:
    """List all available workflows (generated SOPs) with metadata."""
    sops = await service.list_sops()
    results = []
    for s in sops:
        if not s["has_workflow"]:
            continue
        full = await service.get_sop(s["id"])
        results.append({
            "id": s["id"],
            "name": s["name"],
            "description": s["description"],
            "variables": full["variables"],
            "output_schema": full["output_schema"],
        })
    return results


@mcp.tool()
async def start_workflow(name: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Start a workflow by SOP name. Returns {run_id, status}."""
    sops = await service.list_sops()
    match = next((s for s in sops if s["name"] == name), None)
    if not match:
        return {"error": f"No workflow named '{name}'"}
    try:
        run_id = await service.start_run(match["id"], params or {})
        return {"run_id": run_id, "status": "running"}
    except ValueError as e:
        return {"error": str(e)}


@mcp.tool()
async def get_run_status(run_id: str) -> dict[str, Any]:
    """Get current status of a workflow run."""
    run = await service.get_run(run_id)
    if not run:
        return {"error": "Run not found"}
    return {
        "status": run["status"],
        "current_step": run["current_step"],
        "total_steps": run["total_steps"],
    }


@mcp.tool()
async def get_run_result(run_id: str) -> dict[str, Any]:
    """Get the final result of a completed workflow run."""
    run = await service.get_run(run_id)
    if not run:
        return {"error": "Run not found"}
    return {
        "status": run["status"],
        "output": run["output"],
        "error": run["error"],
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
