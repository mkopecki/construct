# workflow-use Integration Guide for Construct

> Consolidated findings from Phase 1 spikes. This document covers everything needed to integrate the [workflow-use](https://github.com/browser-use/workflow-use) library into Construct's FastAPI backend.

---

## Table of Contents

1. [Spike Results Summary](#spike-results-summary)
2. [Library Architecture](#library-architecture)
3. [Dependencies and Setup](#dependencies-and-setup)
4. [Workflow Generation](#workflow-generation)
5. [Workflow JSON Schema](#workflow-json-schema)
6. [Running Workflows](#running-workflows)
7. [Structured Data Extraction](#structured-data-extraction)
8. [Progress Reporting and Cancellation](#progress-reporting-and-cancellation)
9. [Mapping to Construct's Architecture](#mapping-to-constructs-architecture)
10. [Gotchas and Limitations](#gotchas-and-limitations)
11. [Appendix: Example Workflow JSONs](#appendix-example-workflow-jsons)

---

## Spike Results Summary

| Spike | Question | Verdict | Key Finding |
|-------|----------|---------|-------------|
| 1. Programmatic Generation | Can we generate workflows from code, headless? | **PASS** | `HealingService.generate_workflow_from_prompt()` works headless out of the box |
| 2. JSON Schema | Is the workflow schema stable and modelable? | **PASS** | Consistent 6-field top-level schema, discriminated union step types |
| 3. Structured Extraction | Can we get typed key-value output? | **PASS** | `workflow.run(output_model=PydanticModel)` returns validated structured data natively |
| 4. Progress Events | Can we stream per-step progress? | **PASS** | Callbacks during generation; logging capture or `run_step()` loop during replay |

All four core integration assumptions are validated. No pivots needed.

---

## Library Architecture

workflow-use is built on top of [browser-use](https://github.com/browser-use/browser-use). The relationship:

```
browser-use                          workflow-use
├── Browser / BrowserSession         ├── HealingService        (generation)
├── Agent                            ├── Workflow               (replay)
├── Controller                       ├── WorkflowStorageService (persistence)
├── LLM wrappers (ChatOpenAI, etc)   ├── WorkflowDefinitionSchema (schema)
└── Playwright (Chromium)            └── WorkflowController     (step execution)
```

**browser-use** handles the low-level browser automation and LLM orchestration. **workflow-use** adds the workflow layer: recording agent actions into replayable step sequences, semantic element matching, and deterministic execution.

### Key Classes

| Class | Module | Purpose |
|-------|--------|---------|
| `HealingService` | `workflow_use.healing.service` | Generates workflows from prompts. Runs a browser-use agent, converts its action history into workflow steps. |
| `Workflow` | `workflow_use.workflow.service` | Replays a workflow against a browser. Executes steps sequentially, resolves variables, extracts data. |
| `WorkflowDefinitionSchema` | `workflow_use.schema.views` | Pydantic model defining the workflow JSON structure. Validates steps, enforces extraction requirement. |
| `WorkflowStorageService` | `workflow_use.storage.service` | File-based CRUD for workflows. Saves as YAML + metadata JSON. |
| `WorkflowController` | `workflow_use.controller.service` | Executes individual step types (navigate, click, input, extract) against a Playwright page. |

### LLM Abstraction

browser-use ships its own LLM wrappers under `browser_use.llm`. All implement `BaseChatModel`:

```python
from browser_use.llm import ChatOpenAI      # OPENAI_API_KEY
from browser_use.llm import ChatAnthropic    # ANTHROPIC_API_KEY
from browser_use.llm import ChatBrowserUse   # BROWSER_USE_API_KEY (their managed cloud)
from browser_use.llm import ChatGoogle       # Google AI
from browser_use.llm import ChatOllama       # Local models
```

These are **not** langchain wrappers. They're custom implementations with structured output support (`output_format` parameter on `ainvoke`).

---

## Dependencies and Setup

### Python Dependencies

```toml
[project]
requires-python = ">=3.11"
dependencies = [
    "workflow-use",    # Pulls in browser-use automatically
    "openai",          # For ChatOpenAI LLM wrapper
    "python-dotenv",   # Load API keys from .env
    "playwright",      # Browser automation
]
```

### Environment Variables

```bash
OPENAI_API_KEY=sk-...   # Required for ChatOpenAI
```

### Browser Installation

```bash
playwright install chromium
```

This installs a headless Chromium binary (~91MB). Required once per environment.

### Verified Python Version

Tested on Python 3.13.7. Requires 3.11+.

---

## Workflow Generation

Generation is the process of converting a natural language prompt into a replayable workflow. It works by:

1. Launching a headless browser
2. Running a browser-use Agent that executes the task
3. Converting the agent's action history into deterministic workflow steps

### Minimal Example

```python
from browser_use.llm import ChatOpenAI
from workflow_use.healing.service import HealingService

llm = ChatOpenAI(model="gpt-4o-mini")

healing = HealingService(
    llm=llm,
    enable_variable_extraction=True,
    use_deterministic_conversion=True,
)

workflow = await healing.generate_workflow_from_prompt(
    prompt="Go to https://example.com and extract the page title",
    agent_llm=llm,
    extraction_llm=llm,
)
# Returns: WorkflowDefinitionSchema
```

### HealingService Constructor

```python
HealingService(
    llm: BaseChatModel,                           # LLM for workflow creation
    enable_variable_extraction: bool = True,       # Detect parameterizable values
    use_deterministic_conversion: bool = False,    # Skip LLM for step creation
    enable_ai_validation: bool = False,            # Post-generation validation
    enable_pattern_variable_identification: bool = True,  # Regex-based var detection
    pattern_variable_confidence: float = 0.5,
    cleanup_yaml: bool = True,                     # Remove verbose fields
    enable_xpath_optimization: bool = True,
)
```

**Recommended settings for Construct:**
- `use_deterministic_conversion=True` — Faster, cheaper, produces cleaner semantic steps
- `enable_variable_extraction=True` — Detect variables automatically
- `cleanup_yaml=True` — Strip debug fields from output

### generate_workflow_from_prompt Signature

```python
async def generate_workflow_from_prompt(
    self,
    prompt: str,                                    # Natural language task
    agent_llm: BaseChatModel,                       # LLM for browser agent
    extraction_llm: BaseChatModel,                  # LLM for page extraction
    use_cloud: bool = False,                        # Use browser-use cloud
    on_step_recorded: Optional[Callable] = None,    # Per-step callback
    on_status_update: Optional[Callable] = None,    # Status message callback
) -> WorkflowDefinitionSchema
```

### Two Generation Modes

| Mode | Flag | How It Works | Pros | Cons |
|------|------|-------------|------|------|
| **LLM-based** | `use_deterministic_conversion=False` | Agent history → LLM prompt → structured workflow | Richer descriptions, better variable detection | Slower, costs more, may produce `agent` steps |
| **Deterministic** | `use_deterministic_conversion=True` | Agent history → direct mapping to semantic steps | Fast, cheap, guaranteed no `agent` steps | Less descriptive step names |

### What Construct Should Send as the Prompt

The Chrome extension captures user actions and the user annotates them. The backend should assemble a prompt like:

```
Task: Check competitor pricing on Amazon

Steps:
1. Navigate to https://amazon.com
2. Click on the search input field
3. Type "{product_name}" into the search field
4. Click the search button
5. Click on the first product result
6. Extract the product title, price, and stock status

Variables:
- product_name: The product to search for (e.g., "wireless mouse")

Expected Output:
- product_name: string — the full product title
- price: string — the listed price
- in_stock: boolean — whether the item is available
```

The explicit step list from the recording guides the agent. The variables and output schema tell it what to parameterize and what to extract.

---

## Workflow JSON Schema

### Top-Level Structure

Every workflow has exactly these 6 fields:

```json
{
  "name": "string",
  "description": "string",
  "version": "1.0.0",
  "default_wait_time": 0.1,
  "steps": [ ... ],
  "input_schema": [ ... ]
}
```

### Step Types (Discriminated Union on `type`)

#### `navigation`
Navigate to a URL. Always the first step.
```json
{
  "type": "navigation",
  "url": "https://example.com",
  "wait_time": 0.0
}
```

#### `click`
Click an element identified by visible text.
```json
{
  "type": "click",
  "target_text": "Google Search",
  "selectorStrategies": [
    { "type": "text_exact", "value": "Google Search", "priority": 1, "metadata": { "tag": "input" } },
    { "type": "role_text", "value": "Google Search", "priority": 2, "metadata": { "role": "button", "tag": "input" } }
  ],
  "wait_time": 4.39
}
```

#### `input`
Type text into a form field.
```json
{
  "type": "input",
  "value": "browser automation",
  "target_text": "Search",
  "selectorStrategies": [ ... ],
  "wait_time": 4.39
}
```
The `value` field supports `{variable_name}` placeholders.

#### `extract_page_content`
Extract data from the page using the LLM. **Must be the last step** (schema validator enforced).
```json
{
  "type": "extract_page_content",
  "goal": "First search result title and URL",
  "wait_time": 5.53
}
```

#### `extract`
Alternative extraction step (generated by LLM mode instead of deterministic mode).
```json
{
  "type": "extract",
  "extractionGoal": "Product name, price, and availability",
  "wait_time": 3.0
}
```

#### Other Step Types (from schema, less commonly generated)

| Type | Key Fields | Usage |
|------|-----------|-------|
| `key_press` | `key: str` | Press keyboard keys (Tab, Enter, etc.) |
| `select_change` | `selectedText: str` | Select dropdown option by visible text |
| `scroll` | `scrollX: int, scrollY: int` | Scroll the page |
| `go_back` | — | Browser back button |
| `go_forward` | — | Browser forward button |
| `agent` | `task: str, max_steps: int` | Fallback to full AI agent (expensive, avoid) |

### Element Targeting: Semantic-First

workflow-use does **not** use CSS selectors or XPath by default. Elements are matched by:

1. **`target_text`** — The visible or accessible text of the element (primary)
2. **`selectorStrategies`** — Ordered fallback strategies:
   - `text_exact` — Exact match on visible text + HTML tag
   - `role_text` — Match on ARIA role + text

This is the "self-healing" part: if the DOM changes but the button still says "Search", the workflow still works.

Legacy fields `cssSelector` and `xpath` exist in the schema but are **not populated** in deterministic mode. We should not rely on them.

### Input Schema (Variables)

```json
"input_schema": [
  {
    "name": "product_name",
    "type": "string",
    "format": "product search term",
    "required": true,
    "default": "wireless mouse"
  }
]
```

- `type`: `"string"` | `"number"` | `"bool"`
- Variables are referenced in step `value` fields as `{product_name}`
- The `Workflow` class resolves placeholders at runtime from the `inputs` dict

### Fields to Strip Before Storing in Our DB

These are internal/debug artifacts from generation. Safe to discard:

| Field | Why Strip |
|-------|-----------|
| `agent_reasoning` | LLM chain-of-thought. Verbose, not needed for replay. |
| `elementHash` | Internal element tracking hash. Not used in semantic matching. |
| `page_context_url` | URL at generation time. Redundant with runtime state. |
| `page_context_title` | Page title at generation time. Redundant. |
| `workflow_analysis` | Top-level LLM reasoning. Already removed by post-processing. |

The `WorkflowStorageService.save_workflow()` method already strips many of these.

---

## Running Workflows

### Basic Replay

```python
from browser_use.llm import ChatOpenAI
from workflow_use.schema.views import WorkflowDefinitionSchema
from workflow_use.workflow.service import Workflow

llm = ChatOpenAI(model="gpt-4o-mini")

# Load workflow from JSON/YAML
schema = WorkflowDefinitionSchema(**workflow_dict)

workflow = Workflow(
    workflow_schema=schema,
    llm=llm,
    page_extraction_llm=llm,
)

result = await workflow.run(
    inputs={"product_name": "wireless mouse"},  # Variable values
    close_browser_at_end=True,
)
# Returns: WorkflowRunOutput
```

### Workflow Constructor

```python
Workflow(
    workflow_schema: WorkflowDefinitionSchema,
    llm: BaseChatModel,
    *,
    controller: WorkflowController | None = None,
    browser: Browser | None = None,
    page_extraction_llm: BaseChatModel | None = None,
    fallback_to_agent: bool = True,
    use_cloud: bool = False,
)
```

### Three Execution Methods

#### `workflow.run()` — Full control
```python
result = await workflow.run(
    inputs: dict | None = None,              # Variable values
    close_browser_at_end: bool = True,
    cancel_event: asyncio.Event | None = None,  # For cancellation
    output_model: type[BaseModel] | None = None, # For structured output
)
# Returns: WorkflowRunOutput[T]
#   .step_results: List[ActionResult | AgentHistoryList]
#   .output_model: T | None  (populated if output_model was passed)
```

#### `workflow.run_as_tool(prompt)` — For MCP integration
```python
result_json = await workflow.run_as_tool("Check price for wireless mouse")
# Returns: str (JSON)
# {"success": true, "steps_executed": 5, "inputs_used": {"product_name": "wireless mouse"}, "context": {...}}
```
Parses variable values from the natural language prompt using the LLM.

#### `workflow.run_step(index, inputs)` — Individual step execution
```python
result = await workflow.run_step(step_index=0, inputs={"product_name": "mouse"})
# Execute a single step. Useful for progress reporting.
```

### `run_with_no_ai()` — No LLM during replay
```python
result = await workflow.run_with_no_ai(inputs=my_inputs)
```
Uses semantic element matching without any LLM calls during execution. Fastest and cheapest option, but extraction steps still need an LLM for the `page_extraction_llm`.

Fails if the workflow contains any `agent` type steps.

---

## Structured Data Extraction

This is how Construct gets typed, key-value data out of a workflow run.

### The `output_model` Approach (Recommended)

```python
from pydantic import BaseModel, Field

class ProductData(BaseModel):
    product_name: str = Field(description="Full product title")
    price: str = Field(description="Listed price including currency")
    in_stock: bool = Field(description="Whether the item is available")

result = await workflow.run(
    inputs={"search_term": "wireless mouse"},
    output_model=ProductData,
)

# result.output_model is a validated ProductData instance
print(result.output_model.price)      # "$29.99"
print(result.output_model.in_stock)   # True
```

**How it works internally:**
1. Workflow executes all steps, including `extract_page_content` which produces free text
2. After all steps complete, the accumulated extraction results are fed to the LLM along with the Pydantic model's JSON schema
3. The LLM maps the free-text extractions to the structured fields
4. The result is validated against the Pydantic model

### Construct's Extraction Pipeline

```
User defines output schema in Chrome Extension
    │  { "product_name": "string", "price": "string", "in_stock": "boolean" }
    ▼
Backend converts to Pydantic model at runtime
    │  create_model("OutputSchema", product_name=(str, ...), price=(str, ...), in_stock=(bool, ...))
    ▼
Backend appends extract step to workflow if not present
    │  { "type": "extract_page_content", "goal": "Extract product_name, price, in_stock" }
    ▼
Workflow runs with output_model parameter
    │  result = await workflow.run(inputs=..., output_model=DynamicOutputModel)
    ▼
Typed result stored in DB
    │  result.output_model.model_dump()  →  {"product_name": "...", "price": "...", "in_stock": true}
```

### Dynamic Pydantic Model Creation

Since users define output schemas at runtime, we need to create Pydantic models dynamically:

```python
from pydantic import BaseModel, Field, create_model

def build_output_model(schema_fields: list[dict]) -> type[BaseModel]:
    """Convert user-defined output schema to a Pydantic model.

    schema_fields: [
        {"name": "price", "type": "string", "description": "Listed price"},
        {"name": "in_stock", "type": "boolean", "description": "Availability"},
    ]
    """
    type_map = {"string": str, "number": float, "boolean": bool}
    fields = {}
    for f in schema_fields:
        py_type = type_map[f["type"]]
        fields[f["name"]] = (py_type, Field(description=f.get("description", "")))

    return create_model("WorkflowOutput", **fields)
```

### Extraction Without `output_model`

If you just want raw extracted text:

```python
result = await workflow.run()
for step_result in result.step_results:
    if step_result.extracted_content:
        print(step_result.extracted_content)
        # "Example Domain"
        # "This domain is for use in..."
```

Each `ActionResult` has:
- `extracted_content: str | None` — Free text from the extraction LLM
- `success: bool | None`
- `error: str | None`

---

## Progress Reporting and Cancellation

### During Generation

Two synchronous callbacks on `generate_workflow_from_prompt`:

```python
def on_step_recorded(step_data: dict):
    """Fires each time the browser agent performs an action."""
    # step_data keys:
    #   step_number: int       — 1-indexed
    #   action_type: str       — "navigation", "click", "input_text", "extract", "keypress", "scroll"
    #   description: str       — "Click on 'Search'", "Navigate to https://..."
    #   url: str               — Current page URL
    #   selector: str | None   — CSS/XPath if available
    #   extracted_data: dict | None
    #   timestamp: str         — ISO 8601
    #   target_text: str | None

def on_status_update(status: str):
    """Fires for phase transitions."""
    # "Initializing browser..."
    # "Creating browser agent..."
    # "Recording workflow steps..."
    # "Completed recording 5 steps"
    # "Converting steps to workflow (deterministic)..."
    # "Post-processing workflow..."
    # "Workflow generation complete!"
```

**Construct integration:** Push these to the frontend via SSE or WebSocket so the user sees real-time generation progress.

### During Replay

`workflow.run()` does **not** accept a progress callback. Three approaches:

#### Option A: Fire-and-wait (simplest, good for hackathon)
```python
result = await workflow.run(inputs=my_inputs)
# Frontend shows a spinner: "Running workflow... (5 steps)"
```

#### Option B: `run_step()` loop (best for production)
```python
workflow = Workflow(workflow_schema=schema, llm=llm)
await workflow.browser.start()

for i in range(len(schema.steps)):
    emit_progress(step=i+1, total=len(schema.steps), status="running")
    result = await workflow.run_step(i, inputs=my_inputs)
    emit_progress(step=i+1, total=len(schema.steps), status="complete")

await workflow.browser.stop()
```

#### Option C: Logging handler (no code changes to workflow-use)
```python
import logging

class ProgressHandler(logging.Handler):
    def __init__(self, callback):
        super().__init__()
        self.callback = callback

    def emit(self, record):
        msg = record.getMessage()
        if "Running Step" in msg:
            # Parse "--- Running Step 2/5 -- Click Search ---"
            self.callback(msg)

handler = ProgressHandler(my_callback)
logging.getLogger("workflow_use.workflow.service").addHandler(handler)
```

### Cancellation

```python
cancel_event = asyncio.Event()

# In a background task or signal handler:
cancel_event.set()  # Stops after the current step completes

result = await workflow.run(
    inputs=my_inputs,
    cancel_event=cancel_event,
)
# result.step_results contains only the steps that ran before cancellation
```

Tested and confirmed: cancellation is clean — no dangling browser sessions.

---

## Mapping to Construct's Architecture

### Chrome Extension → Backend → workflow-use

```
Chrome Extension POST /api/recordings
    │
    │  Body: {
    │    "name": "Check Amazon pricing",
    │    "description": "Search for a product and extract price",
    │    "steps": [
    │      {"type": "navigation", "url": "https://amazon.com"},
    │      {"type": "click", "target": "search box"},
    │      {"type": "input", "target": "search box", "value": "wireless mouse", "is_variable": true, "variable_name": "product_name"},
    │      {"type": "click", "target": "search button"},
    │      {"type": "click", "target": "first result"}
    │    ],
    │    "variables": [{"name": "product_name", "type": "string", "default": "wireless mouse"}],
    │    "output_schema": [
    │      {"name": "title", "type": "string", "description": "Product title"},
    │      {"name": "price", "type": "string", "description": "Listed price"},
    │      {"name": "in_stock", "type": "boolean", "description": "Availability"}
    │    ]
    │  }
    ▼
Backend assembles prompt
    │  "Task: Check Amazon pricing\n\nSteps:\n1. Navigate to..."
    ▼
HealingService.generate_workflow_from_prompt(prompt, ...)
    │  → Browser agent executes the task
    │  → Deterministic converter produces workflow JSON
    ▼
WorkflowDefinitionSchema saved to DB
    │  Store the raw workflow JSON + our metadata (user, output_schema, etc.)
    ▼
POST /api/workflows/{id}/run  (or MCP run_workflow)
    │  inputs: {"product_name": "gaming mouse"}
    ▼
Workflow(schema, llm).run(inputs=..., output_model=DynamicModel)
    │  → Replays steps headless
    │  → Extracts structured data
    ▼
Result stored in DB, returned to caller
    │  {"title": "Logitech G502", "price": "$49.99", "in_stock": true}
```

### Data Model Mapping

| Construct Concept | workflow-use Object | Our DB |
|-------------------|-------------------|--------|
| SOP (workflow) | `WorkflowDefinitionSchema` | `workflows` table: id, name, description, workflow_json (the full schema), output_schema, created_at |
| Variable | `WorkflowInputSchemaDefinition` | Embedded in workflow_json under `input_schema` |
| Step | `WorkflowStep` (union type) | Embedded in workflow_json under `steps` |
| Run | `WorkflowRunOutput` | `runs` table: id, workflow_id, inputs, status, started_at, finished_at |
| Run Result | `output_model` instance | `run_results` table: run_id, output_json (structured), raw_extractions (step-level text) |

### MCP Server Integration

```python
# MCP tool: run_workflow
async def run_workflow(name: str, params: dict) -> dict:
    workflow_record = db.get_workflow_by_name(name)
    schema = WorkflowDefinitionSchema(**workflow_record.workflow_json)

    # Build output model from stored schema
    OutputModel = build_output_model(workflow_record.output_schema)

    workflow = Workflow(schema, llm=llm, page_extraction_llm=llm)
    result = await workflow.run(inputs=params, output_model=OutputModel)

    # Store run result
    run_id = db.save_run(workflow_record.id, params, result)

    return result.output_model.model_dump()
```

Alternatively, `workflow.run_as_tool(prompt)` can be used if the MCP caller sends natural language instead of structured params. It uses the LLM to parse variable values from the prompt.

---

## Gotchas and Limitations

### Generation
1. **gpt-4o-mini struggles with ambiguous instructions.** Prompts must be specific about which elements to click. "Click the 'More information' link" fails if the actual text is "Learn more". The recording from the Chrome extension should use the exact text seen on the page.
2. **Last step must be extraction.** The `WorkflowDefinitionSchema` validator enforces that every workflow ends with `extract` or `extract_page_content`. If the user's recording doesn't include extraction, we need to append one.
3. **Variable detection is unreliable with gpt-4o-mini.** Pattern-based identification (regex) works for obvious cases (emails, URLs, dates). LLM-based detection sometimes fails silently. For Construct, we don't need automatic detection — the user marks variables in the Chrome extension.
4. **Generation takes 20-60s** depending on task complexity and LLM latency. The browser agent needs to physically execute the task. Budget for this in UX (show generation progress).
5. **`write_file` and `done` actions are skipped** during deterministic step conversion. Only navigation, click, input, extraction, and similar DOM actions become workflow steps.

### Replay
6. **Semantic matching can fail on ambiguous pages.** If multiple buttons say "Submit", the workflow may click the wrong one. The `selectorStrategies` provide fallback, but it's not guaranteed. Container hints (`container_hint` field) can help disambiguate.
7. **`wait_time` values from generation are based on the original execution speed.** They may be too short on slower connections or too long for fast pages. Consider making these configurable or using adaptive waits.
8. **No authentication handling.** workflow-use doesn't manage login sessions. Workflows that require authentication will fail on replay unless the browser session has cookies/tokens pre-loaded. This is a known limitation for Construct's hackathon scope.
9. **Page readiness timeout warnings** (`'Page' object has no attribute 'wait_for_load_state'`) appear during navigation but don't affect execution. This is a compatibility issue between browser-use versions.

### Schema
10. **The `agent` step type is expensive.** Agent steps invoke a full browser-use Agent for a sub-task, costing LLM calls per step. Deterministic mode (`use_deterministic_conversion=True`) avoids these entirely.
11. **`selectorStrategies` are not populated for all elements.** Only elements the agent directly interacted with get strategies. Navigation and extraction steps have no selectors.

---

## Appendix: Example Workflow JSONs

### Simple Navigation + Extraction (3 steps)

```json
{
  "name": "Extract example.com data",
  "description": "Navigate to example.com and extract page info",
  "version": "1.0.0",
  "default_wait_time": 0.1,
  "steps": [
    {
      "type": "navigation",
      "url": "https://example.com",
      "wait_time": 0.0
    },
    {
      "type": "extract_page_content",
      "goal": "title",
      "wait_time": 5.36
    },
    {
      "type": "extract_page_content",
      "goal": "first paragraph of text",
      "wait_time": 5.36
    }
  ],
  "input_schema": []
}
```

### Form Fill + Extraction (5 steps)

```json
{
  "name": "Google search and extract first result",
  "description": "Search Google and extract the top result",
  "version": "1.0.0",
  "default_wait_time": 0.1,
  "steps": [
    {
      "type": "navigation",
      "url": "https://www.google.com"
    },
    {
      "type": "input",
      "value": "browser automation",
      "target_text": "Search",
      "selectorStrategies": [
        { "type": "text_exact", "value": "Search", "priority": 1, "metadata": { "tag": "textarea" } },
        { "type": "role_text", "value": "Search", "priority": 2, "metadata": { "role": "combobox", "tag": "textarea" } }
      ],
      "wait_time": 4.39
    },
    {
      "type": "click",
      "target_text": "Google Search",
      "selectorStrategies": [
        { "type": "text_exact", "value": "Google Search", "priority": 1, "metadata": { "tag": "input" } },
        { "type": "role_text", "value": "Google Search", "priority": 2, "metadata": { "role": "button", "tag": "input" } }
      ],
      "wait_time": 4.39
    },
    {
      "type": "click",
      "target_text": "Search",
      "selectorStrategies": [
        { "type": "text_exact", "value": "Search", "priority": 1, "metadata": { "tag": "button" } },
        { "type": "role_text", "value": "Search", "priority": 2, "metadata": { "role": "button", "tag": "button" } }
      ],
      "wait_time": 4.46
    },
    {
      "type": "extract_page_content",
      "goal": "First search result title and URL",
      "wait_time": 5.53
    }
  ],
  "input_schema": []
}
```

### Minimal Extraction (2 steps)

```json
{
  "name": "Extract top HN story",
  "description": "Get the title and URL of the top Hacker News story",
  "version": "1.0.0",
  "default_wait_time": 0.1,
  "steps": [
    {
      "type": "navigation",
      "url": "https://news.ycombinator.com"
    },
    {
      "type": "extract_page_content",
      "goal": "title and URL of the top story",
      "wait_time": 6.86
    }
  ],
  "input_schema": []
}
```

### Workflow with Variables (template)

```json
{
  "name": "Amazon price check",
  "description": "Search Amazon for a product and extract pricing",
  "version": "1.0.0",
  "default_wait_time": 0.1,
  "steps": [
    { "type": "navigation", "url": "https://www.amazon.com" },
    { "type": "input", "value": "{product_name}", "target_text": "Search Amazon" },
    { "type": "key_press", "key": "Enter" },
    { "type": "click", "target_text": "first product result" },
    { "type": "extract_page_content", "goal": "Extract the product title, price, and stock availability" }
  ],
  "input_schema": [
    { "name": "product_name", "type": "string", "required": true, "default": "wireless mouse" }
  ]
}
```
