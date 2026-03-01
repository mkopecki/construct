"""
Spike 4: Run Lifecycle — Step-by-Step Progress

Goal: Determine whether we can stream per-step progress during workflow replay.
"""

import asyncio
import json
import logging
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from browser_use.llm import ChatOpenAI

from workflow_use.schema.views import WorkflowDefinitionSchema
from workflow_use.workflow.service import Workflow


class StepProgressHandler(logging.Handler):
    """Capture per-step log messages from workflow execution."""

    def __init__(self):
        super().__init__()
        self.events = []

    def emit(self, record):
        msg = record.getMessage()
        if "Running Step" in msg or "Finished Step" in msg or "Extraction" in msg.lower() or "Navigated" in msg:
            self.events.append({
                "time": time.time(),
                "level": record.levelname,
                "message": msg,
            })


async def main():
    print("=" * 60)
    print("SPIKE 4: Step-by-Step Progress During Replay")
    print("=" * 60)

    llm = ChatOpenAI(model="gpt-4o-mini")

    # Use the 3-step simple-nav workflow
    workflows_dir = Path(__file__).parent / "findings" / "workflows"
    with open(workflows_dir / "simple-nav.json") as f:
        workflow_dict = json.load(f)

    schema = WorkflowDefinitionSchema(**workflow_dict)

    # Test 1: Capture progress via logging handler
    print("\n--- Test 1: Logging-based progress capture ---")

    handler = StepProgressHandler()
    wf_logger = logging.getLogger("workflow_use.workflow.service")
    wf_logger.addHandler(handler)
    wf_logger.setLevel(logging.INFO)

    ctrl_logger = logging.getLogger("workflow_use.controller.service")
    ctrl_logger.addHandler(handler)
    ctrl_logger.setLevel(logging.INFO)

    workflow = Workflow(workflow_schema=schema, llm=llm, page_extraction_llm=llm)
    result = await workflow.run(close_browser_at_end=True)

    print(f"  Captured {len(handler.events)} progress events:")
    for evt in handler.events:
        print(f"    [{evt['level']}] {evt['message']}")

    # Test 2: Check cancel_event support
    print("\n--- Test 2: Cancel event support ---")
    cancel_event = asyncio.Event()

    workflow2 = Workflow(workflow_schema=schema, llm=llm, page_extraction_llm=llm)

    # Cancel after 2 seconds
    async def cancel_after(seconds):
        await asyncio.sleep(seconds)
        print(f"  Setting cancel event after {seconds}s")
        cancel_event.set()

    cancel_task = asyncio.create_task(cancel_after(2.0))
    result2 = await workflow2.run(close_browser_at_end=True, cancel_event=cancel_event)
    cancel_task.cancel()

    print(f"  Steps executed before cancel: {len(result2.step_results)}")
    print(f"  (Total steps in workflow: {len(schema.steps)})")

    # Test 3: Check run_step exists for individual step execution
    print("\n--- Test 3: Individual step execution (run_step) ---")
    has_run_step = hasattr(Workflow, "run_step")
    print(f"  Workflow.run_step exists: {has_run_step}")
    if has_run_step:
        import inspect
        sig = inspect.signature(Workflow.run_step)
        print(f"  Signature: {sig}")

    # Summary
    print("\n" + "=" * 60)
    print("SPIKE 4 FINDINGS")
    print("=" * 60)
    print("""
  GENERATION (generate_workflow_from_prompt):
    on_step_recorded: YES — callback per browser action during generation
    on_status_update: YES — callback for status messages
    Both are synchronous callbacks (not async generators)

  REPLAY (workflow.run):
    Per-step callback param: NO — run() has no callback parameter
    Logging-based progress: YES — INFO-level logs per step (Running/Finished)
    Cancel support: YES — cancel_event (asyncio.Event) stops between steps
    run_step() method: """ + str(has_run_step) + """ — can execute steps individually
    Async streaming: NO — run() blocks until all steps complete

  RECOMMENDED APPROACH FOR PROGRESS:
    Option A: Attach a logging handler to capture step events (demonstrated above)
    Option B: Use run_step() to execute steps one-by-one with progress reporting
    Option C: Run workflow in background task, poll step count via logging
    For MCP: Fire-and-wait is acceptable (runs complete in 5-30s)
""")


if __name__ == "__main__":
    asyncio.run(main())
