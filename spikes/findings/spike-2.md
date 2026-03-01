# Spike 2: Workflow JSON Schema

## Result: PASS

We have a clear, documented schema we can map to our data model.

## Top-Level Schema

All 3 generated workflows share identical top-level structure:

```json
{
  "name": "string",              // Workflow name (defaults to prompt text)
  "description": "string",       // Human-readable description
  "version": "1.0.0",            // Always "1.0.0" currently
  "default_wait_time": 0.1,      // Default delay between steps (seconds)
  "steps": [...],                // Ordered list of workflow steps
  "input_schema": [...]          // Variable definitions (empty if none detected)
}
```

**Stable across all runs.** No optional/variable top-level fields observed.

## Step Types

From 3 workflows, we observed 4 step types:

### 1. `navigation`
```json
{
  "type": "navigation",
  "url": "https://example.com",
  "wait_time": 0.0,               // optional
  "agent_reasoning": "Start"      // internal, can be stripped
}
```

### 2. `input`
```json
{
  "type": "input",
  "value": "browser automation",          // Text to type
  "target_text": "Search",                // Semantic element identifier
  "selectorStrategies": [...],            // Fallback selectors (see below)
  "wait_time": 4.39,
  "elementHash": "11380b7852",            // Internal hash, can be stripped
  "agent_reasoning": "...",               // Internal, can be stripped
  "page_context_url": "https://...",      // URL where action happened
  "page_context_title": "Google"          // Page title (optional)
}
```

### 3. `click`
```json
{
  "type": "click",
  "target_text": "Google Search",         // Semantic element identifier
  "selectorStrategies": [...],            // Fallback selectors
  "wait_time": 4.39,
  "elementHash": "...",                   // Internal
  "agent_reasoning": "...",               // Internal
  "page_context_url": "...",
  "page_context_title": "..."
}
```

### 4. `extract_page_content`
```json
{
  "type": "extract_page_content",
  "goal": "First search result title and URL",  // What to extract
  "wait_time": 5.53
}
```

### Other step types (from schema, not yet observed in our runs):
- `extract` — similar to extract_page_content, uses `extractionGoal` field
- `key_press` — press keyboard keys (`key` field)
- `select_change` — dropdown selection (`selectedText` field)
- `scroll` — page scrolling (`scrollX`, `scrollY`)
- `go_back` / `go_forward` — browser history navigation
- `agent` — fallback to AI agent for a sub-task (`task`, `max_steps`)

## Selector Strategy

Elements are targeted **semantically first** via `target_text`, with fallback strategies:

```json
"selectorStrategies": [
  {
    "type": "text_exact",
    "value": "Search",
    "priority": 1,
    "metadata": {"tag": "textarea"}
  },
  {
    "type": "role_text",
    "value": "Search",
    "priority": 2,
    "metadata": {"role": "combobox", "tag": "textarea"}
  }
]
```

Strategy types observed:
- `text_exact` — match by visible text
- `role_text` — match by ARIA role + text

**No DOM selectors (CSS/XPath) by default.** The library deliberately uses semantic matching. Legacy `cssSelector` and `xpath` fields exist but are not populated in deterministic mode.

## Input Schema (Variables)

When variables are detected, `input_schema` contains:
```json
{
  "name": "product_name",
  "type": "string",           // "string" | "number" | "bool"
  "format": "optional format hint",
  "required": true,
  "default": "wireless mouse"
}
```

Variables are referenced in step values as `{variable_name}` placeholders.

**Note:** gpt-4o-mini failed to identify variables in our simple test cases. Variable identification works better with more complex prompts that explicitly mention parameterizable values.

## Fields to Strip for Our DB

These fields are internal/debug and should not be stored:
- `agent_reasoning` — LLM chain-of-thought during generation
- `elementHash` — internal element tracking hash
- `page_context_url` — redundant (we track URL per step anyway)
- `page_context_title` — redundant
- `workflow_analysis` — LLM reasoning (removed by post-processing)

## Schema Stability

The schema is **stable and predictable**:
- Top-level fields are consistent across all runs
- Step types use a discriminated union on the `type` field
- The Pydantic model (`WorkflowDefinitionSchema`) validates structure
- We can safely model this in our DB

## Example Workflows

See `findings/workflows/`:
- `simple-nav.json` — Navigate + extract (3 steps)
- `form-fill.json` — Navigate + input + click + extract (5 steps)
- `multi-step.json` — Navigate + extract (2 steps)
