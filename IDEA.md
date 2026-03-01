# Construct

**Record browser workflows by demonstration, run them on autopilot.**

## Problem

Users have repeatable browser-based SOPs (checking competitor pricing, submitting forms across portals, pulling invoices) but can't automate them without writing code or learning an RPA tool. Describing workflows precisely enough for AI execution is surprisingly hard.

## Core Insight

People can't always *describe* their workflows, but they can *show* them. We use a lightweight Chrome extension to watch the user perform a task once, then convert that demonstration into a structured prompt that drives [workflow-use](https://github.com/browser-use/workflow-use) to generate a replayable, self-healing workflow.

## How It Works

```
Record (Chrome Extension, single tab)
    │  Captures: URLs, clicks, text input, page loads
    ▼
Annotate (Extension UI)
    │  User describes the flow, marks variables, defines output schema with examples
    ▼
Generate & Verify (workflow-use)
    │  Structured prompt → browser-use executes once → workflow JSON
    │  User reviews step-by-step log, confirms or adjusts
    ▼
Run (Web UI / MCP)
    │  Inspect, trigger, or let your AI assistant run it
    ▼
Results (stored in DB, served via MCP)
```

### 1. Record — Chrome Extension

A thin capture layer, not a full RPA recorder. Listens for:
- Navigation events (URL changes)
- Click events (element visible text / aria-label)
- Text input events (field + value)

Captures *intent*, not DOM selectors. ~150 lines of code.

Scope: **single tab only**. No popup/multi-tab tracking.

After recording, the user sees their steps as an editable list where they can:
- Mark any text input as a **variable** (e.g., "search term")
- Define **expected output data** with a structured example — the user is prompted: "What data should this workflow return?" and must provide a concrete example:
  ```
  Expected Output:
  - product_name: string — the full product title (e.g., "Apple AirPods Max")
  - price: string — the listed price (e.g., "$549.00")
  - in_stock: boolean — whether the item is available (e.g., true)
  ```
  This schema becomes the output contract: workflow-use knows what to extract, and the MCP server returns predictable, typed results.
- Add a plain-text description of what the workflow does

### 2. Generate — Prompt Assembly + workflow-use

The backend assembles a structured prompt from the recording:

```
Task: Check competitor pricing on Amazon

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
- product_name: string — the full product title (e.g., "Apple AirPods Max")
- price: string — the listed price (e.g., "$549.00")
- in_stock: boolean — whether the item is available (e.g., true)
```

This prompt is fed to workflow-use's generation mode, which executes the flow once with browser-use and produces a deterministic, replayable workflow JSON. The user reviews a step-by-step log of the generation run and confirms "yes, that's what I meant" or goes back to adjust. This single generate-and-verify pass closes the gap between what was recorded and what workflow-use actually produced.

### 3. Inspect + Run — Web Frontend

The central dashboard for managing all automation. Shows:
- **SOPs** — all recorded workflows, their steps, and configuration
- **Runs** — full history of every execution, with step-by-step status (passed / healed / failed)
- **Results** — extracted output data from each run, stored in the database

The user can also:
- Edit variables / parameters per workflow
- Trigger a run manually
- Drill into any run to see individual step outcomes and extracted data

### 4. Run from AI — MCP Server

An MCP server exposes workflows as tools:
- `list_workflows` — see available automations
- `run_workflow(name, params)` — execute a workflow, returns structured output data
- `get_run_result(run_id)` — retrieve results from a previous run

All workflow output is persisted in the database and served through MCP. The chat assistant can both trigger workflows and retrieve their results — making it the primary interface for power users.

This is the key differentiator: "I told my AI assistant to check competitor prices and it just did it."

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Chrome Extension │────▶│  Backend (FastAPI)│◀───▶│  Web Frontend   │
│                  │     │                   │     │  (Next.js)      │
│ - event capture  │     │  - prompt assembly│     │  - SOP list     │
│ - step review    │     │  - workflow CRUD  │     │  - run trigger   │
│ - var marking    │     │  - run engine     │     │  - run history   │
│ - output prompts │     │  - result storage │     │  - step details  │
└─────────────────┘     │  - MCP server     │     │  - result viewer │
                        └──────────────────┘     └─────────────────┘
                              ▲
                              │ MCP
                        ┌─────────────┐
                        │ Claude/Chat │
                        └─────────────┘
```

## Hackathon Scope

### Build (priority order)
1. Chrome extension — record, review steps, mark variables, POST to backend
2. FastAPI backend — receive recording, assemble prompt, call workflow-use, store workflows
3. MCP server — `list_workflows` + `run_workflow` tools
4. Web UI — view workflows, trigger runs, see results

### Skip
- User auth / multi-tenancy (single user, local-first)
- Authentication handling in workflows (known limitation, stated upfront)
- Robust scheduling (mention in pitch, cron job at most)
- Multi-tab / popup flows (single tab only)
- Custom Chrome extension recorder fidelity (lean on workflow-use for the hard part)

## Demo Story

> "I open Amazon, search for a product, and note the price. I do this every morning for 5 competitors. Watch — I'll do it once with Construct recording, then never do it manually again. Now I ask Claude: 'run my pricing check for wireless mice' and it just happens."
