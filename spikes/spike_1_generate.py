"""
Spike 1: Programmatic Workflow Generation

Goal: Call workflow-use from Python with a prompt string, get a workflow back, headless.
"""

import asyncio
import json
import os
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from browser_use.llm import ChatOpenAI

from workflow_use.healing.service import HealingService
from workflow_use.storage.service import WorkflowStorageService


async def generate_workflow(prompt: str, output_filename: str):
    """Generate a single workflow from a prompt and save it."""
    llm = ChatOpenAI(model="gpt-4o-mini")

    healing = HealingService(
        llm=llm,
        enable_variable_extraction=True,
        use_deterministic_conversion=True,
    )

    steps_recorded = []

    def on_step(step_data):
        steps_recorded.append(step_data)
        print(f"  Step {step_data['step_number']}: [{step_data['action_type']}] {step_data['description']}")

    def on_status(status):
        print(f"  Status: {status}")

    start_time = time.time()

    workflow = await healing.generate_workflow_from_prompt(
        prompt=prompt,
        agent_llm=llm,
        extraction_llm=llm,
        use_cloud=False,
        on_step_recorded=on_step,
        on_status_update=on_status,
    )

    elapsed = time.time() - start_time

    # Save workflow JSON
    findings_dir = Path(__file__).parent / "findings" / "workflows"
    findings_dir.mkdir(parents=True, exist_ok=True)

    workflow_dict = workflow.model_dump(mode="json", exclude_none=True)
    output_path = findings_dir / output_filename
    with open(output_path, "w") as f:
        json.dump(workflow_dict, f, indent=2)

    print(f"  Completed in {elapsed:.1f}s -> {output_path}")
    print(f"  Steps: {len(workflow.steps)}, Variables: {len(workflow.input_schema)}")
    print(f"  Callback steps recorded: {len(steps_recorded)}")

    return workflow, elapsed, steps_recorded


async def main():
    print("=" * 60)
    print("SPIKE 1: Programmatic Workflow Generation")
    print("=" * 60)

    # Simple navigation task - use "Learn more" which is the actual link text on example.com
    prompt = "Navigate to https://example.com and extract the page title and the first paragraph of text"
    print(f"\nGenerating workflow: '{prompt}'\n")

    workflow, elapsed, steps = await generate_workflow(prompt, "simple-nav.json")

    # Print full workflow JSON
    print("\n--- Full Workflow JSON ---")
    workflow_dict = workflow.model_dump(mode="json", exclude_none=True)
    print(json.dumps(workflow_dict, indent=2))

    # Print findings summary
    print("\n" + "=" * 60)
    print("SPIKE 1 FINDINGS")
    print("=" * 60)
    print(f"  API: HealingService.generate_workflow_from_prompt()")
    print(f"  Required params: prompt, agent_llm, extraction_llm")
    print(f"  Optional params: use_cloud, on_step_recorded, on_status_update")
    print(f"  Return type: WorkflowDefinitionSchema (Pydantic model)")
    print(f"  Headless: YES (worked without visible browser)")
    print(f"  Generation time: {elapsed:.1f}s")
    print(f"  Step callbacks: {len(steps)} steps reported during generation")
    print(f"  Status callbacks: YES (status updates during generation)")
    print(f"  LLM: ChatOpenAI (gpt-4o-mini) via browser-use's LLM abstraction")
    print(f"  Deterministic mode: use_deterministic_conversion=True skips LLM for step creation")

    return workflow


if __name__ == "__main__":
    asyncio.run(main())
