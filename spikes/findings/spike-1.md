# Spike 1: Programmatic Workflow Generation

## Result: PASS

## API Surface

### Generation Entry Point
```python
from workflow_use.healing.service import HealingService
from browser_use.llm import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")
healing = HealingService(
    llm=llm,
    enable_variable_extraction=True,
    use_deterministic_conversion=True,  # faster, no LLM for step creation
)

workflow = await healing.generate_workflow_from_prompt(
    prompt="Navigate to https://example.com and extract the page title",
    agent_llm=llm,
    extraction_llm=llm,
    use_cloud=False,           # local headless browser
    on_step_recorded=callback, # per-step progress callback
    on_status_update=callback, # status message callback
)
# Returns: WorkflowDefinitionSchema (Pydantic model)
```

### Key Parameters
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `prompt` | str | Yes | Natural language task description |
| `agent_llm` | BaseChatModel | Yes | LLM for browser agent decision-making |
| `extraction_llm` | BaseChatModel | Yes | LLM for page content extraction |
| `use_cloud` | bool | No | Default False. Use browser-use cloud browser |
| `on_step_recorded` | Callable | No | Callback per step: `{step_number, action_type, description, url, selector, extracted_data, timestamp, target_text}` |
| `on_status_update` | Callable | No | Callback for status strings |

### Return Type
`WorkflowDefinitionSchema` — Pydantic model with fields:
- `name: str`
- `description: str`
- `version: str`
- `default_wait_time: float`
- `steps: List[WorkflowStep]` (discriminated union of step types)
- `input_schema: List[WorkflowInputSchemaDefinition]`

### LLM Abstraction
browser-use provides its own LLM wrappers that implement `BaseChatModel`:
- `ChatOpenAI` — uses `OPENAI_API_KEY` env var
- `ChatAnthropic` — uses `ANTHROPIC_API_KEY` env var
- `ChatBrowserUse` — their managed cloud LLM

## Headless Support
YES — works with default settings. No `BrowserConfig` needed. The agent runs a headless Chromium browser via Playwright.

## Generation Modes
1. **LLM-based** (default): Agent records actions → LLM converts history to workflow steps
2. **Deterministic** (`use_deterministic_conversion=True`): Agent records actions → direct conversion to steps without LLM. Faster, cheaper, produces semantic steps (no agent steps).

## Performance
- Simple navigation + extraction: **~35s** (with gpt-4o-mini)
- Most time is the browser agent executing the task, not workflow conversion

## Gotchas
1. gpt-4o-mini can struggle with ambiguous link text — needs precise prompts
2. Workflow schema **requires** the last step to be an `extract` or `extract_page_content` step (validator enforced)
3. The `on_step_recorded` callback fires during *generation* (agent execution), not during replay
4. `write_file` and `done` actions from the agent are skipped during step conversion
5. Variable extraction can fail silently with gpt-4o-mini (warning logged but continues)

## Storage
```python
from workflow_use.storage.service import WorkflowStorageService

storage = WorkflowStorageService(storage_dir="./storage")
metadata = storage.save_workflow(workflow, generation_mode="browser_use", original_task=prompt)
# Saves as YAML file + metadata JSON
```
