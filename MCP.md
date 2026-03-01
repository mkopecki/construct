# Construct MCP Integration

Construct exposes an [MCP](https://modelcontextprotocol.io/) server so that chat assistants (Claude Desktop, Cursor, etc.) can list, run, and poll browser-automation workflows.

## Starting the server

```bash
.venv/bin/python -m server.mcp_server
```

Transport is **stdio** — the MCP client spawns the process and communicates over stdin/stdout.

## Client configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "construct": {
      "command": "/path/to/construct/.venv/bin/python",
      "args": ["-m", "server.mcp_server"],
      "cwd": "/path/to/construct",
      "env": {
        "BROWSER_USE_API_KEY": "..."
      }
    }
  }
}
```

### Claude Code

Add to `.claude/settings.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "construct": {
      "command": "/path/to/construct/.venv/bin/python",
      "args": ["-m", "server.mcp_server"],
      "cwd": "/path/to/construct",
      "env": {
        "BROWSER_USE_API_KEY": "..."
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "construct": {
      "command": "/path/to/construct/.venv/bin/python",
      "args": ["-m", "server.mcp_server"],
      "cwd": "/path/to/construct",
      "env": {
        "BROWSER_USE_API_KEY": "..."
      }
    }
  }
}
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BROWSER_USE_API_KEY` | Yes | — | Browser-use API key for workflow execution |
| `BROWSER_USE_API_URL` | No | `https://api.browser-use.com` | Browser-use API endpoint |
| `CONSTRUCT_DB` | No | `./data/construct.db` | Path to the SQLite database |

The MCP server shares the same SQLite database as the FastAPI server (WAL mode handles concurrent access).

## Tools

### `list_workflows`

Returns all SOPs that have a generated workflow.

**Parameters:** none

**Returns:**

```json
[
  {
    "id": "a1b2c3d4e5f6",
    "name": "Search Google",
    "description": "Search Google and extract results",
    "has_workflow": true,
    "created_at": "2025-01-15T10:00:00+00:00",
    "updated_at": "2025-01-15T10:05:00+00:00"
  }
]
```

### `start_workflow`

Starts a workflow run in the background. The run executes asynchronously — poll with `get_run_status` / `get_run_result`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Exact SOP name (from `list_workflows`) |
| `params` | object | No | Input variables for the workflow |

**Returns:**

```json
{ "run_id": "f7e8d9c0b1a2", "status": "running" }
```

### `get_run_status`

Poll the progress of a running workflow.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `run_id` | string | Yes | Run ID from `start_workflow` |

**Returns:**

```json
{ "status": "running", "current_step": 3, "total_steps": 5 }
```

Status values: `pending`, `running`, `passed`, `failed`, `cancelled`.

### `get_run_result`

Get the final output of a completed run.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `run_id` | string | Yes | Run ID from `start_workflow` |

**Returns:**

```json
{
  "status": "passed",
  "output": { "price": "$29.99", "title": "Example Product" },
  "error": null
}
```

## Typical assistant flow

```
User:      "Look up the price of X on Amazon"
Assistant: calls list_workflows() → finds "Amazon Price Lookup"
Assistant: calls start_workflow("Amazon Price Lookup", {"query": "X"})
           → receives {"run_id": "abc123", "status": "running"}
Assistant: calls get_run_status("abc123")
           → {"status": "running", "current_step": 2, "total_steps": 4}
Assistant: calls get_run_result("abc123")
           → {"status": "passed", "output": {"price": "$29.99"}, "error": null}
Assistant: "The price of X on Amazon is $29.99."
```

The assistant polls `get_run_status` until status is `passed` or `failed`, then reads the result with `get_run_result`.
