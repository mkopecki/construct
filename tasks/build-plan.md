# Construct — Build Plan

## What's Done

### Phase 1: Spike the Unknowns ✅

All four integration assumptions validated. No pivots needed.

| Spike | Result |
|-------|--------|
| 1. Programmatic generation | `HealingService.generate_workflow_from_prompt()` works headless. Deterministic mode recommended. |
| 2. Workflow JSON schema | Stable 6-field schema. Steps are a discriminated union. Variables via `input_schema`. Must end with extraction step. |
| 3. Structured extraction | `workflow.run(output_model=PydanticModel)` returns typed data natively. Dynamic Pydantic models via `create_model()`. |
| 4. Progress & timing | Generation: `on_step_recorded` + `on_status_update` callbacks. Replay: fire-and-wait or `run_step()` loop. 20-60s generation, 5-30s replay. |

Artifacts: `spikes/findings/` (4 spike reports, integration guide, 3 example workflow JSONs).

### Phase 2: Chrome Extension (v1) ✅

Built, not wired to backend. Captures 4 event types (navigate, click, input, select) from a single tab. MV3, TypeScript, tsup build.

| Component | Status |
|-----------|--------|
| `content-script.ts` | Done — click, change listeners, element description, field label extraction, deduplication |
| `service-worker.ts` | Done — recording state in `chrome.storage.session`, navigation tracking, content script re-injection |
| `popup.ts` + `popup.html` | Done — record/stop toggle, event counter |
| `types.ts` | Done — NavigateEvent, ClickEvent, InputEvent, SelectEvent |
| `config.ts` | Done — BACKEND_URL, WEB_UI_URL constants |
| Backend POST on stop | **Stubbed** — logs locally, does not POST to `/api/recordings` |
| Redirect to web UI | **Stubbed** — does not open annotation page |

### Phase 3: Backend Architecture ✅

Data model, Pydantic schemas, prompt assembly, SSE helper, and config designed and implemented. No API routes or workflow engine yet.

| Component | Status |
|-----------|--------|
| `server/db.py` | Done — SQLite schema (sops + runs tables), async via aiosqlite |
| `server/models.py` | Done — request/response Pydantic models for all endpoints |
| `server/prompt.py` | Done — `build_generation_prompt()` assembles structured prompt from SOP metadata |
| `server/config.py` | Done — env-based config (OpenAI key, model, DB path, host, port, web UI URL) |
| `server/sse.py` | Done — SSE event formatter |
| `server/main.py` | **Not started** — no FastAPI app |
| Route handlers | **Not started** |
| Workflow engine | **Not started** |
| MCP server | **Not started** |

---

## What's Left

### Phase 4: Backend API Server

The core backend. Everything depends on this.

#### 4.1 — FastAPI app setup

Create `server/main.py`:
- FastAPI app with CORS (allow extension + web UI origins)
- Lifespan handler that calls `init_db()` on startup
- Mount all route groups

#### 4.2 — Recording endpoint

`POST /api/recordings`
- Receives `{ startUrl, events }` from the Chrome extension
- Creates an SOP record in the DB with `recorded_events` populated, everything else empty
- Returns `{ recording_id }` (the SOP id)

This is the bridge between the extension and the web UI annotation step.

#### 4.3 — SOP CRUD endpoints

- `GET /api/sops` — list all SOPs (returns `SOPSummary[]`)
- `GET /api/sops/{id}` — get full SOP detail (returns `SOPDetail`)
- `PATCH /api/sops/{id}` — update SOP fields (name, description, steps, variables, output_schema) — used by the annotation page
- `DELETE /api/sops/{id}` — delete an SOP and its runs

#### 4.4 — Workflow generation endpoint

`POST /api/sops/{id}/generate` (SSE stream)
- Reads the SOP's annotated data (steps, variables, output_schema)
- Calls `build_generation_prompt()` to assemble the prompt
- Calls `HealingService.generate_workflow_from_prompt()` with:
  - `use_deterministic_conversion=True`
  - `on_step_recorded` callback → SSE event per step
  - `on_status_update` callback → SSE status event
- On success: saves `workflow_json` to the SOP record, streams final SSE event
- On failure: streams error SSE event

Uses SSE so the web UI can show real-time generation progress.

#### 4.5 — Workflow execution engine

Create `server/engine.py`:
- `start_run(sop_id, params)` → creates a run record (status=pending), spawns a background task, returns `run_id`
- Background task:
  1. Load SOP's `workflow_json`, build `WorkflowDefinitionSchema`
  2. Build dynamic Pydantic output model from `output_schema` using `create_model()`
  3. Append `extract_page_content` step if workflow doesn't end with one
  4. Create `Workflow` instance, call `workflow.run(inputs=params, output_model=OutputModel, close_browser_at_end=True)`
  5. Update run record: step_results, output (from `result.output_model.model_dump()`), status, timestamps
  6. On failure: update run with error and status=failed

#### 4.6 — Run endpoints

- `POST /api/runs` — start a new run (accepts `{ sop_id, params }`), returns `{ run_id, status }`
- `GET /api/runs/{id}` — get run detail (returns `RunDetail` — status, current_step, step_results, output)
- `GET /api/sops/{id}/runs` — list runs for an SOP (returns `RunSummary[]`)

### Phase 5: Wire Up the Chrome Extension

Connect the stubbed-out parts to the real backend.

#### 5.1 — POST recording on stop

In `service-worker.ts`, replace the stub with a real `fetch()` to `POST /api/recordings`. Handle errors (backend unreachable, etc.).

#### 5.2 — Redirect to annotation page

On successful POST, open `{WEB_UI_URL}/recordings/{recording_id}/annotate` in a new tab.

Small, self-contained — depends only on Phase 4.2 being done.

### Phase 6: Web Frontend

The user-facing application. Built with Next.js (or Vite + React — decide at build time based on speed preference).

#### 6.1 — Project setup

Scaffold the frontend app in `web/`:
- React + TypeScript
- Tailwind CSS for styling
- API client module that talks to the FastAPI backend

#### 6.2 — Annotation page (`/recordings/{id}/annotate`)

The first page a user sees after recording. This is the critical creation flow.

- Fetches the SOP by ID (which has `recorded_events` but no annotation yet)
- Displays recorded steps as an editable list, pre-filled from raw events
- **Name input**: text field for SOP name
- **Description input**: textarea
- **Step editor**: each step shown as a row. User can:
  - Edit the step description text
  - Delete a step
  - Reorder steps (drag or up/down buttons)
- **Variable marking**: on input-type steps, a toggle or button to "make this a variable" — prompts for variable name, sets a default from the original value
- **Output schema editor**: repeatable rows of `field name` + `example value`, with add/remove
- **Generate button**: PATCHes the SOP with all annotation data, then calls `POST /api/sops/{id}/generate`
- **Generation progress**: streams SSE events, shows a step-by-step log
- **Verify**: on completion, shows the generated workflow summary. Approve (redirects to dashboard) or Reject (returns to annotation)

#### 6.3 — Dashboard (`/`)

The SOP list — the main landing page.

- Fetches `GET /api/sops`
- Shows each SOP as a card: name, description, last run status, run count
- Click → navigates to SOP detail page

#### 6.4 — SOP detail page (`/sops/{id}`)

- Fetches `GET /api/sops/{id}` and `GET /api/sops/{id}/runs`
- **Config section**: steps, variables (with defaults), output schema — read-only display
- **Run section**:
  - Variable input form (pre-populated with defaults)
  - "Run" button → calls `POST /api/runs`, then polls `GET /api/runs/{id}` for status
  - Shows run progress (step X of Y) and result on completion
- **Run history**: list of past runs with status, timestamp, link to detail

#### 6.5 — Run detail page (`/runs/{id}`)

- Fetches `GET /api/runs/{id}`
- Step-by-step breakdown: each step with status indicator (passed / healed / failed) and detail text
- Output section: key-value table of extracted data
- **Retry button**: starts a new run with the same params

### Phase 7: MCP Server

The differentiator. Expose workflows as tools for chat assistants.

#### 7.1 — MCP server setup

Create `server/mcp_server.py`:
- Uses the MCP Python SDK (`mcp` package)
- Runs as a separate process (stdio transport for Claude Desktop/Claude Code)
- Shares the same SQLite DB as the FastAPI backend

#### 7.2 — `list_workflows` tool

Returns all SOPs with name, description, variable definitions (name + example), and output schema. The assistant uses this to match user intent.

#### 7.3 — `start_workflow` tool

Takes `name` (string) and `params` (object). Looks up the SOP by name, creates a run, kicks off execution in a background thread, returns `{ run_id, status: "running" }` immediately.

#### 7.4 — `get_run_status` tool

Takes `run_id`. Returns `{ status, current_step, total_steps }`. The assistant polls this.

#### 7.5 — `get_run_result` tool

Takes `run_id`. Returns `{ status, output }` where output is the key-value extraction result.

#### 7.6 — MCP config file

Provide a `construct-mcp.json` config snippet users can add to Claude Desktop / Claude Code settings to register the server:

```json
{
  "mcpServers": {
    "construct": {
      "command": "python",
      "args": ["-m", "server.mcp_server"],
      "cwd": "/path/to/construct"
    }
  }
}
```

### Phase 8: Integration Testing & Demo Polish

#### 8.1 — End-to-end test

Manual walkthrough of the full loop:
1. Record a flow with the extension
2. Annotate in the web UI
3. Generate & verify
4. Run from the web UI — confirm output is correct
5. Run from Claude via MCP — confirm start/poll/result cycle works

#### 8.2 — Demo preparation

- Pick one compelling SOP (Amazon price check or similar)
- Pre-record it so the demo doesn't depend on live network
- Prepare the Claude conversation showing the MCP interaction
- Have a fallback: pre-generated workflow JSON in case live generation is slow

---

## Dependency Graph

```
Phase 1 (spikes) ✅
    │
Phase 2 (extension v1) ✅
    │
Phase 3 (backend architecture) ✅
    │
Phase 4 (backend API) ◄── everything starts here
    ├── 4.1 app setup
    ├── 4.2 recording endpoint ──────────► Phase 5 (wire extension)
    ├── 4.3 SOP CRUD ───────────────────► Phase 6.2 (annotation page)
    ├── 4.4 generation endpoint ────────► Phase 6.2 (generate button)
    ├── 4.5 execution engine ───────────► Phase 6.4 (run from UI)
    │                                    ► Phase 7 (MCP server)
    └── 4.6 run endpoints ─────────────► Phase 6.4, 6.5 (run pages)
                                         ► Phase 7.3, 7.4, 7.5 (MCP tools)

Phase 5 (wire extension) — unblocked by 4.2
Phase 6 (web frontend) — unblocked incrementally by 4.2-4.6
Phase 7 (MCP server) — unblocked by 4.5 + 4.6
Phase 8 (integration test) — after 5 + 6 + 7
```

## Parallelization Opportunities

These can be built concurrently by separate people/agents:

| Stream A | Stream B | Stream C |
|----------|----------|----------|
| Phase 4: Backend API (4.1→4.6) | Phase 6.1: Frontend setup | — |
| Phase 5: Wire extension (after 4.2) | Phase 6.2: Annotation page (after 4.2+4.3) | Phase 7: MCP server (after 4.5+4.6) |
| — | Phase 6.3-6.5: Dashboard + run pages (after 4.3+4.6) | Phase 8: Demo polish |

**Critical path**: Phase 4 (backend) → Phase 6.2 (annotation) + Phase 7 (MCP) → Phase 8 (integration test).
