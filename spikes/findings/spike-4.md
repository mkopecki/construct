# Spike 4: Run Lifecycle and Progress Events

## Result: PASS

We can show per-step progress during both generation and replay.

## Generation Progress (generate_workflow_from_prompt)

Two callback parameters available:

### `on_step_recorded` — per browser action
```python
def on_step(step_data: dict):
    # step_data keys:
    #   step_number: int (1-indexed)
    #   action_type: str ("navigation", "click", "input_text", "extract", "keypress", "scroll")
    #   description: str (human-readable, e.g. "Click on 'Search'")
    #   url: str (current page URL)
    #   selector: str | None (CSS/XPath if available)
    #   extracted_data: dict | None (for extract steps)
    #   timestamp: str (ISO 8601)
    #   target_text: str | None (element text being interacted with)

healing.generate_workflow_from_prompt(
    ...,
    on_step_recorded=on_step,
)
```

### `on_status_update` — status messages
```python
def on_status(status: str):
    # Example messages:
    #   "Initializing browser..."
    #   "Creating browser agent..."
    #   "Recording workflow steps..."
    #   "Completed recording 5 steps"
    #   "Converting steps to workflow (deterministic)..."
    #   "Post-processing workflow (variable identification & cleanup)..."
    #   "Workflow generation complete!"
```

Both callbacks are synchronous (called directly, not awaited). Can wrap with `asyncio.create_task()` if async work is needed.

## Replay Progress (workflow.run)

### No native callback parameter
`workflow.run()` does not accept a progress callback. It blocks until all steps complete.

### Logging-based progress capture (works)
```python
import logging

class StepProgressHandler(logging.Handler):
    def emit(self, record):
        msg = record.getMessage()
        if "Running Step" in msg or "Finished Step" in msg:
            # Emit to frontend...

handler = StepProgressHandler()
logging.getLogger("workflow_use.workflow.service").addHandler(handler)
```

Captured events per step:
- `"--- Running Step 1/3 -- <description> ---"`
- `"🔗  Navigated to URL: ..."` (for navigation)
- `"Extracted content: ..."` (for extraction)
- `"--- Finished Step 1 ---"`

### Individual step execution (run_step)
```python
# Execute steps one by one with progress reporting
for i in range(len(schema.steps)):
    result = await workflow.run_step(i, inputs=my_inputs)
    emit_progress(step=i, total=len(schema.steps))
```
`run_step(step_index, inputs)` exists and can be used for fine-grained control.

### Cancel support
```python
cancel_event = asyncio.Event()
result = await workflow.run(cancel_event=cancel_event)
# Set cancel_event from another coroutine to stop between steps
```
Tested: cancellation works cleanly between steps.

## Recommended Approach for Construct

### During generation (recording):
Use `on_step_recorded` + `on_status_update` callbacks → push to frontend via SSE/WebSocket.

### During replay (running):
**Option A (simple):** Fire-and-wait. Runs complete in 5-30s. Show a spinner with step count.

**Option B (streaming):** Use `run_step()` loop to execute steps individually, emitting progress between each step. This gives full control over progress reporting.

**Option C (logging):** Attach a logging handler to capture per-step messages. Less clean but works without modifying execution flow.

For the hackathon, Option A is sufficient. Option B is the right production approach.
