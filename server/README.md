# Construct Server

Python backend that manages SOPs (Standard Operating Procedures), generates browser-automation workflows via workflow-use, executes them, and streams progress over SSE.

## Quick start

```bash
# Install dependencies
pip install -e .

# Set your OpenAI key
export OPENAI_API_KEY="sk-..."

# Start the API server
python -m server
```

The server starts on `http://localhost:8000`. The SQLite database is created automatically at `./data/construct.db`.

## Module structure

```
server/
    __init__.py          Package marker
    __main__.py          Entry point — python -m server → uvicorn
    app.py               FastAPI app, CORS, lifespan (DB init)
    config.py            Settings from environment variables
    db.py                SQLite schema + connection (aiosqlite, WAL mode)
    models.py            Pydantic request/response models
    services.py          Core business logic (ConstructService)
    routes.py            FastAPI route handlers
    sse.py               SSE format helper
    prompt.py            Assemble workflow-use prompt from annotated SOP
    mcp_server.py        Separate MCP server entry point
```

## Configuration

All settings come from environment variables (loaded via `python-dotenv`).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | LLM model for workflow-use |
| `CONSTRUCT_DB` | No | `./data/construct.db` | SQLite database path |
| `HOST` | No | `0.0.0.0` | Server bind address |
| `PORT` | No | `8000` | Server port |
| `WEB_UI_URL` | No | `http://localhost:5173` | Allowed CORS origin |

## Database

SQLite with WAL mode for concurrent access. Two tables, no ORM.

### `sops`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Also serves as the recording ID |
| `name` | TEXT | Display name |
| `description` | TEXT | User-provided description |
| `recorded_events` | TEXT (JSON) | Raw events from Chrome extension |
| `steps` | TEXT (JSON) | Annotated step descriptions |
| `variables` | TEXT (JSON) | Input variable definitions |
| `output_schema` | TEXT (JSON) | Expected output field definitions |
| `workflow_json` | TEXT (JSON, nullable) | Generated workflow-use schema |
| `created_at` | TEXT | ISO 8601 timestamp |
| `updated_at` | TEXT | ISO 8601 timestamp |

### `runs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Run identifier |
| `sop_id` | TEXT FK | References `sops.id` |
| `params` | TEXT (JSON) | Input variable values |
| `status` | TEXT | `pending` / `running` / `passed` / `failed` / `cancelled` |
| `current_step` | INT | Last completed step index |
| `total_steps` | INT | Total steps in workflow |
| `step_results` | TEXT (JSON) | Per-step status and errors |
| `output` | TEXT (JSON, nullable) | Structured extraction result |
| `error` | TEXT (nullable) | Error message if failed |
| `started_at` | TEXT | ISO 8601 timestamp |
| `finished_at` | TEXT | ISO 8601 timestamp |

## API

### Recordings

#### `POST /api/recordings`

Chrome extension posts a recording. Creates an SOP directly — the returned `recording_id` is the SOP ID.

**Request:**

```json
{
  "startUrl": "https://example.com",
  "events": [
    { "type": "navigate", "url": "https://example.com", "timestamp": 1 },
    { "type": "click", "text": "Sign in", "tag": "button", "role": "button", "ariaLabel": null, "pageUrl": "https://example.com", "timestamp": 2 }
  ]
}
```

**Response:** `{ "recording_id": "a1b2c3d4e5f6" }`

### SOPs

#### `GET /api/sops`

List all SOPs.

**Response:**

```json
[
  {
    "id": "a1b2c3d4e5f6",
    "name": "Recording a1b2c3d4e5f6",
    "description": "",
    "has_workflow": false,
    "created_at": "2025-01-15T10:00:00+00:00",
    "updated_at": "2025-01-15T10:00:00+00:00"
  }
]
```

#### `GET /api/sops/{id}`

Full SOP detail including `recorded_events`, `steps`, `variables`, `output_schema`, and `workflow_json`.

#### `PUT /api/sops/{id}`

Update annotation fields. All fields are optional — only provided fields are updated.

**Request:**

```json
{
  "name": "Amazon Price Lookup",
  "description": "Search Amazon and extract product price",
  "steps": [
    { "description": "Navigate to amazon.com" },
    { "description": "Type search query into search bar" },
    { "description": "Click the first result" }
  ],
  "variables": [
    { "name": "query", "description": "Search term", "example": "wireless mouse" }
  ],
  "output_schema": [
    { "name": "price", "type": "string", "example": "$29.99" },
    { "name": "title", "type": "string", "example": "Logitech M720" }
  ]
}
```

**Response:** `{ "ok": true }`

#### `DELETE /api/sops/{id}`

Delete an SOP and all its runs.

### Workflow Generation

#### `POST /api/sops/{id}/generate`

Generates a workflow-use workflow from the annotated SOP. Returns an **SSE stream**.

**SSE events:**

```
data: {"type": "status", "message": "Starting workflow generation..."}

data: {"type": "step", "step_number": 1, "action_type": "navigation", "description": "Navigate to amazon.com"}

data: {"type": "complete", "workflow": { ... }}

data: {"type": "error", "message": "Generation failed: ..."}
```

The generated workflow is saved to the SOP's `workflow_json` column on completion.

### Runs

#### `POST /api/runs`

Execute a workflow. Returns an **SSE stream**.

**Request body:** `{ "sop_id": "a1b2c3d4e5f6", "params": { "query": "wireless mouse" } }`

**SSE events:**

```
data: {"type": "run_started", "run_id": "f7e8d9c0b1a2", "total_steps": 5}

data: {"type": "step_start", "step": 1, "total": 5}

data: {"type": "step_complete", "step": 1, "total": 5}

data: {"type": "complete", "run_id": "f7e8d9c0b1a2", "output": {"price": "$29.99"}}

data: {"type": "error", "message": "Step 3 failed: element not found", "step": 3}
```

#### `GET /api/runs/{id}`

Run detail — used by MCP server for polling.

#### `GET /api/sops/{id}/runs`

Run history for an SOP.

#### `POST /api/runs/{id}/cancel`

Cancel an active run. Returns `{ "ok": true }` if cancelled, 404 if not active.

## SSE consumption

The generation and run endpoints are POST requests returning `text/event-stream`. Use `fetch()` + `ReadableStream` (not `EventSource`, which only supports GET):

```javascript
const res = await fetch("/api/runs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sop_id: "abc", params: {} }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  // Each SSE message: "data: {...}\n\n"
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      const event = JSON.parse(line.slice(6));
      console.log(event.type, event);
    }
  }
}
```

## Data flow

```
Chrome Extension
    │
    ▼
POST /api/recordings ──► SOP created (raw events stored)
    │
    ▼
Web UI annotation ──► PUT /api/sops/{id} (steps, variables, output_schema)
    │
    ▼
POST /api/sops/{id}/generate ──► workflow-use generates workflow ──► workflow_json saved
    │
    ▼
POST /api/runs ──► workflow executes step-by-step ──► results stored in runs table
    │
    ▼
MCP server / Web UI ──► GET /api/runs/{id} to read results
```

## MCP server

The MCP server runs as a separate process (`python -m server.mcp_server`) and shares the SQLite database. See [MCP.md](../MCP.md) for integration instructions.
