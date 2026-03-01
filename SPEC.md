# Construct — Product Spec

## Overview

Construct lets users automate repeatable browser workflows by demonstrating them once. A Chrome extension captures the user's actions, a web UI lets them annotate and configure the workflow, and the backend uses the [Browser Use API](https://docs.browser-use.com) + [workflow-use](https://github.com/browser-use/workflow-use) to generate and execute replayable automations. Workflows are runnable from the web UI or through an MCP server (from a chat assistant like Claude).

---

## User Flows

### Flow 1: Create an SOP

#### Step 1 — Record (Chrome Extension)

The extension is a minimal capture layer. Single tab only.

User clicks "Record" → performs their browser task → clicks "Stop."

The extension captures raw events:
- **Navigate**: `{ type: "navigate", url: "https://..." }`
- **Click**: `{ type: "click", text: "Add to Cart", tag: "button" }`
- **Input**: `{ type: "input", placeholder: "Search", value: "wireless mouse" }`

On stop, the extension POSTs the raw event list to the backend and redirects the user to the web UI annotation page.

#### Step 2 — Annotate (Web UI)

The web UI shows the captured steps as an editable list, pre-filled from the recording. The user:

1. **Names the SOP** — a short, descriptive name (e.g., "Amazon Price Check"). This is what appears in the dashboard and in MCP tool listings.
2. **Edits steps** — reword, reorder, or delete captured actions if the recording was noisy.
3. **Marks variables** — clicks any input value to convert it to a named parameter (e.g., the typed value "wireless mouse" becomes `{product_name}`).
4. **Defines output schema** — adds key-value pairs for what the workflow should return. Each row is a field name + example value:
   ```
   price        →  "$549.00"
   product_name →  "Apple AirPods Max"
   in_stock     →  "true"
   ```
5. **Adds a description** — plain text explaining what this SOP does and when to use it. This description is surfaced in MCP tool metadata so the chat assistant can match user intent to the right workflow.

#### Step 3 — Generate & Verify (Web UI → Backend)

User clicks "Generate." The backend:

1. Assembles a structured prompt from the annotated recording:
   ```
   Task: Amazon Price Check
   Description: Check the price and availability of a product on Amazon.

   Steps:
   1. Navigate to https://amazon.com
   2. Click on the search input field
   3. Type "{product_name}" into the search field
   4. Click the search button
   5. Click on the first product result
   6. Extract the expected output data from the product page

   Variables:
   - product_name: The product to search for (e.g., "wireless mouse")

   Expected Output:
   - price: e.g., "$549.00"
   - product_name: e.g., "Apple AirPods Max"
   - in_stock: e.g., "true"
   ```
2. Sends this to workflow-use's generation mode via the Browser Use API, which executes the flow once headless and produces a workflow JSON.
3. Streams a step-by-step log back to the web UI as the generation run progresses.

The user reviews the result:
- **Approve** → SOP is saved to the database.
- **Reject** → user returns to the annotation step to adjust, then re-generates. The raw recording stays fixed; if the recording itself was wrong, the user re-records from scratch.

---

### Flow 2: Run an SOP

Two entry points, same backend execution path.

#### Entry A — Web UI

1. User picks an SOP from the dashboard.
2. Fills in variable values (pre-populated with defaults/examples).
3. Clicks "Run."
4. The web UI shows a run log: step-by-step status updates as the workflow executes.
5. On completion, the extracted output is displayed.

#### Entry B — MCP (Chat Assistant)

1. User tells their assistant: "Check the price of AirPods Max on Amazon."
2. The assistant calls `list_workflows` to see available SOPs and their descriptions.
3. The assistant matches intent to the right SOP, extracts parameters from the user's message.
4. The assistant calls `start_workflow(name: "Amazon Price Check", params: { product_name: "AirPods Max" })` → receives a `run_id` immediately.
5. The assistant polls `get_run_status(run_id)` until the run completes (informing the user of progress).
6. The assistant calls `get_run_result(run_id)` to fetch the extracted output.
7. The assistant formats and presents the result: "AirPods Max is $549.00, currently in stock."

#### Backend Execution (shared)

1. Load the SOP's workflow JSON.
2. Execute via the Browser Use API (headless).
3. Each step runs sequentially; if a step fails, workflow-use falls back to browser-use for self-healing.
4. On the final step, extract output data matching the SOP's output schema.
5. Store the run record (params, step results, output, status, timestamps) in the database.
6. Return the output to the caller (web UI or MCP).

---

### Flow 3: Inspect History (Web UI)

The dashboard is the central view for all automation activity.

#### SOP List

All saved SOPs with name, description, last run status, and run count.

#### SOP Detail

- Configuration: steps, variables (with defaults), output schema.
- Run history: chronological list of all runs for this SOP.

#### Run Detail

- Step-by-step breakdown: each step with status (passed / healed / failed) and detail.
- Output: the extracted key-value data.
- **Retry button**: re-run with the same parameters.

---

## Data Model

```
SOP
├── id
├── name                    — user-provided, used in MCP tool listings
├── description             — what this SOP does (surfaced in MCP metadata)
├── recorded_events[]       — raw capture from Chrome extension
├── steps[]                 — annotated step descriptions
├── variables[]             — { name, description, example_value }
├── output_schema[]         — { field_name, example_value }
├── workflow_json           — generated workflow-use blob
├── created_at
│
└── Run
    ├── id
    ├── sop_id
    ├── params              — variable values for this run
    ├── status              — pending / running / passed / failed
    ├── step_results[]      — { step_index, status, detail }
    ├── output              — extracted key-value data matching output_schema
    ├── started_at
    └── finished_at
```

---

## MCP Server

Workflow runs take 30-60 seconds (browser navigation, page loads, self-healing). Most MCP clients enforce a ~60s hard timeout on tool calls (Claude Desktop's is not configurable). A single blocking `run_workflow` call would be fragile.

Instead, we use a **start/poll/result** pattern — three tools that the assistant calls in sequence. This works with every MCP client today, no experimental spec features required.

### `list_workflows`

Returns all saved SOPs with their name, description, variables (with examples), and output schema. This gives the chat assistant enough context to match user intent to the right workflow and construct the correct parameters.

### `start_workflow(name, params)`

Kicks off a workflow run asynchronously. Takes the SOP name and a key-value map of variable values. Returns a `run_id` immediately (within seconds, well under any timeout).

```json
// Request
{ "name": "Amazon Price Check", "params": { "product_name": "AirPods Max" } }

// Response
{ "run_id": "run_abc123", "status": "running" }
```

### `get_run_status(run_id)`

Returns the current status of a run: `running`, `passed`, or `failed`. The assistant polls this until the run reaches a terminal state. Includes the current step index so the assistant can inform the user of progress.

```json
// Response (in progress)
{ "run_id": "run_abc123", "status": "running", "current_step": 3, "total_steps": 6 }

// Response (complete)
{ "run_id": "run_abc123", "status": "passed" }
```

### `get_run_result(run_id)`

Retrieves the extracted output data from a completed run. Returns key-value pairs matching the SOP's output schema.

```json
// Response
{
  "run_id": "run_abc123",
  "status": "passed",
  "output": {
    "price": "$549.00",
    "product_name": "Apple AirPods Max",
    "in_stock": "true"
  }
}
```

### Typical assistant interaction

```
User:      "Check the price of AirPods Max on Amazon"
Assistant: calls list_workflows → finds "Amazon Price Check"
Assistant: calls start_workflow("Amazon Price Check", { product_name: "AirPods Max" })
           → receives run_id: "run_abc123"
Assistant: "Running your price check, this'll take about 30 seconds..."
Assistant: calls get_run_status("run_abc123") → { status: "running", current_step: 3, total_steps: 6 }
Assistant: calls get_run_status("run_abc123") → { status: "passed" }
Assistant: calls get_run_result("run_abc123") → { price: "$549.00", in_stock: "true", ... }
Assistant: "AirPods Max is $549.00 on Amazon, currently in stock."
```

---

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ Chrome Extension │────▶│  Backend (FastAPI)    │◀───▶│  Web Frontend   │
│                  │     │                       │     │  (Next.js)      │
│ - record/stop    │     │  - prompt assembly    │     │                 │
│ - POST raw events│     │  - Browser Use API    │     │  - SOP list     │
│ - redirect to UI │     │  - workflow CRUD      │     │  - annotation   │
└─────────────────┘     │  - run engine         │     │  - run trigger  │
                        │  - result storage     │     │  - run history  │
                        │  - MCP server         │     │  - run detail   │
                        └──────────────────────┘     └─────────────────┘
                              ▲
                              │ MCP
                        ┌─────────────┐
                        │ Claude/Chat │
                        └─────────────┘
```

---

## Hackathon Scope

### Build (priority order)

1. Chrome extension — record, stop, POST raw events, redirect to web UI
2. FastAPI backend — receive recording, store SOPs, assemble prompts, call Browser Use API / workflow-use, store runs + results
3. Web UI — annotation page, SOP dashboard, run trigger, run history + detail
4. MCP server — `list_workflows`, `run_workflow`, `get_run_result`

### Skip

- User auth / multi-tenancy (single user, local-first)
- Authentication handling in workflows (known limitation)
- Scheduling (mention in pitch only)
- Multi-tab / popup flows (single tab only)
- Editing an existing SOP (delete and re-record instead)
- Batch runs (single execution per trigger)

---

## Demo Story

> I record myself checking a product price on Amazon — takes 30 seconds. Construct asks me to name it, mark the search term as a variable, and tell it what data to extract: price and availability. It generates the workflow, I verify it works. Now I switch to Claude and say: "Check the price of AirPods Max on Amazon." Ten seconds later: "$549.00, in stock." All from a 30-second recording, runnable forever.
