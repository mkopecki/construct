"""
Spike 2: Workflow JSON Schema

Goal: Generate 3 workflows, diff them, document the stable schema.
We already have simple-nav.json from Spike 1. Generate 2 more.
"""

import asyncio
import json
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from browser_use.llm import ChatOpenAI

from workflow_use.healing.service import HealingService


FINDINGS_DIR = Path(__file__).parent / "findings" / "workflows"


async def generate_workflow(prompt: str, output_filename: str):
    """Generate a single workflow from a prompt and save it."""
    llm = ChatOpenAI(model="gpt-4o-mini")

    healing = HealingService(
        llm=llm,
        enable_variable_extraction=True,
        use_deterministic_conversion=True,
    )

    def on_step(step_data):
        print(f"  Step {step_data['step_number']}: [{step_data['action_type']}] {step_data['description']}")

    start_time = time.time()

    workflow = await healing.generate_workflow_from_prompt(
        prompt=prompt,
        agent_llm=llm,
        extraction_llm=llm,
        use_cloud=False,
        on_step_recorded=on_step,
    )

    elapsed = time.time() - start_time

    workflow_dict = workflow.model_dump(mode="json", exclude_none=True)
    output_path = FINDINGS_DIR / output_filename
    with open(output_path, "w") as f:
        json.dump(workflow_dict, f, indent=2)

    print(f"  -> {elapsed:.1f}s, {len(workflow.steps)} steps, saved to {output_filename}")
    return workflow_dict, elapsed


async def main():
    FINDINGS_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("SPIKE 2: Workflow JSON Schema")
    print("=" * 60)

    # Workflow 2: Form fill (Google search)
    print("\n--- Workflow 2: Form Fill ---")
    form_fill, t2 = await generate_workflow(
        "Go to https://www.google.com, type 'browser automation' into the search box, press Enter, and extract the title and URL of the first search result",
        "form-fill.json",
    )

    # Workflow 3: Multi-step (Hacker News)
    print("\n--- Workflow 3: Multi-step ---")
    multi_step, t3 = await generate_workflow(
        "Go to https://news.ycombinator.com, extract the title and URL of the top story on the page",
        "multi-step.json",
    )

    # Load simple-nav from Spike 1
    simple_nav_path = FINDINGS_DIR / "simple-nav.json"
    with open(simple_nav_path) as f:
        simple_nav = json.load(f)

    # Analyze schemas
    print("\n" + "=" * 60)
    print("SCHEMA ANALYSIS")
    print("=" * 60)

    workflows = {
        "simple-nav": simple_nav,
        "form-fill": form_fill,
        "multi-step": multi_step,
    }

    # Top-level fields
    print("\n--- Top-Level Fields ---")
    all_top_keys = set()
    for name, wf in workflows.items():
        keys = set(wf.keys())
        all_top_keys |= keys
        print(f"  {name}: {sorted(keys)}")

    print(f"\n  Union of all top-level keys: {sorted(all_top_keys)}")

    # Step types seen
    print("\n--- Step Types ---")
    all_step_types = set()
    for name, wf in workflows.items():
        types = [s.get("type", "unknown") for s in wf.get("steps", [])]
        all_step_types.update(types)
        print(f"  {name}: {types}")

    print(f"\n  All step types seen: {sorted(all_step_types)}")

    # Step fields per type
    print("\n--- Step Fields by Type ---")
    fields_by_type = {}
    for wf in workflows.values():
        for step in wf.get("steps", []):
            step_type = step.get("type", "unknown")
            if step_type not in fields_by_type:
                fields_by_type[step_type] = set()
            fields_by_type[step_type] |= set(step.keys())

    for step_type, fields in sorted(fields_by_type.items()):
        print(f"  {step_type}: {sorted(fields)}")

    # Input schema
    print("\n--- Input Schemas ---")
    for name, wf in workflows.items():
        schema = wf.get("input_schema", [])
        if schema:
            print(f"  {name}: {json.dumps(schema, indent=4)}")
        else:
            print(f"  {name}: (none)")

    # Selector strategy
    print("\n--- Selector Strategies ---")
    for name, wf in workflows.items():
        for i, step in enumerate(wf.get("steps", [])):
            if step.get("target_text") or step.get("selectorStrategies") or step.get("cssSelector"):
                print(f"  {name} step {i}: target_text={step.get('target_text')}, cssSelector={step.get('cssSelector')}, selectorStrategies={step.get('selectorStrategies')}")


if __name__ == "__main__":
    asyncio.run(main())
