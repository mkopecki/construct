"""
Spike 3: Structured Data Extraction

Goal: Confirm we can get key-value output from a workflow run.
"""

import asyncio
import json
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from browser_use import Browser
from browser_use.llm import ChatOpenAI
from pydantic import BaseModel, Field

from workflow_use.workflow.service import Workflow
from workflow_use.schema.views import WorkflowDefinitionSchema


class ExtractionOutput(BaseModel):
    """Structured output model for extraction test."""
    page_title: str = Field(description="The page title")
    first_paragraph: str = Field(description="The first paragraph of text")
    link_text: str = Field(description="The text of the first link on the page")


async def main():
    print("=" * 60)
    print("SPIKE 3: Structured Data Extraction")
    print("=" * 60)

    llm = ChatOpenAI(model="gpt-4o-mini")

    # Test 1: Run a workflow with extract step and inspect return value
    print("\n--- Test 1: Run workflow with extract step ---")

    # Use the simple-nav workflow from Spike 1
    workflow_path = Path(__file__).parent / "findings" / "workflows" / "simple-nav.json"
    with open(workflow_path) as f:
        workflow_dict = json.load(f)

    schema = WorkflowDefinitionSchema(**workflow_dict)

    workflow = Workflow(
        workflow_schema=schema,
        llm=llm,
        page_extraction_llm=llm,
    )

    print(f"  Running workflow: {schema.name}")
    print(f"  Steps: {len(schema.steps)}")

    start_time = time.time()
    result = await workflow.run(close_browser_at_end=True)
    elapsed = time.time() - start_time

    print(f"\n  Completed in {elapsed:.1f}s")
    print(f"  Result type: {type(result)}")
    print(f"  Step results count: {len(result.step_results)}")

    # Inspect each step result
    for i, step_result in enumerate(result.step_results):
        print(f"\n  Step {i+1} result:")
        print(f"    Type: {type(step_result).__name__}")
        if hasattr(step_result, 'extracted_content'):
            print(f"    extracted_content: {step_result.extracted_content}")
        if hasattr(step_result, 'success'):
            print(f"    success: {step_result.success}")
        if hasattr(step_result, 'error'):
            print(f"    error: {step_result.error}")
        # Print all fields
        if hasattr(step_result, 'model_dump'):
            print(f"    Full: {step_result.model_dump()}")
        elif hasattr(step_result, '__dict__'):
            print(f"    Full: {step_result.__dict__}")

    # Check the workflow context (where outputs are stored)
    print(f"\n  Workflow context: {json.dumps(workflow.context, indent=2, default=str)}")

    # Test 2: Run with output_model for structured extraction
    print("\n--- Test 2: Run with output_model (structured) ---")

    # Build a workflow that extracts structured data
    extract_workflow_dict = {
        "name": "Extract example.com data",
        "description": "Extract structured data from example.com",
        "version": "1.0.0",
        "default_wait_time": 0.1,
        "steps": [
            {"type": "navigation", "url": "https://example.com"},
            {
                "type": "extract_page_content",
                "goal": "Extract the page title, first paragraph text, and the text of the first link",
                "wait_time": 2.0,
            },
        ],
        "input_schema": [],
    }

    schema2 = WorkflowDefinitionSchema(**extract_workflow_dict)
    workflow2 = Workflow(
        workflow_schema=schema2,
        llm=llm,
        page_extraction_llm=llm,
    )

    start_time = time.time()
    result2 = await workflow2.run(
        close_browser_at_end=True,
        output_model=ExtractionOutput,
    )
    elapsed2 = time.time() - start_time

    print(f"  Completed in {elapsed2:.1f}s")
    print(f"  output_model present: {result2.output_model is not None}")

    if result2.output_model:
        print(f"  output_model type: {type(result2.output_model).__name__}")
        print(f"  output_model data: {result2.output_model.model_dump()}")
    else:
        print("  No output_model returned")
        # Check step results for extracted content
        for i, sr in enumerate(result2.step_results):
            if hasattr(sr, 'extracted_content') and sr.extracted_content:
                print(f"  Step {i+1} extracted_content: {sr.extracted_content}")

    print(f"\n  Workflow context: {json.dumps(workflow2.context, indent=2, default=str)}")

    # Test 3: run_as_tool (returns JSON string)
    print("\n--- Test 3: run_as_tool (returns JSON string) ---")

    workflow3 = Workflow(
        workflow_schema=schema2,
        llm=llm,
        page_extraction_llm=llm,
    )

    start_time = time.time()
    tool_result = await workflow3.run_as_tool("Extract data from example.com")
    elapsed3 = time.time() - start_time

    print(f"  Completed in {elapsed3:.1f}s")
    print(f"  Return type: {type(tool_result).__name__}")
    print(f"  Result: {tool_result}")

    # Summary
    print("\n" + "=" * 60)
    print("SPIKE 3 FINDINGS")
    print("=" * 60)
    print("  workflow.run() returns WorkflowRunOutput with step_results list")
    print("  Each step result has extracted_content (string) and success (bool)")
    print("  workflow.run(output_model=PydanticModel) converts results to structured model")
    print("  workflow.run_as_tool(prompt) returns JSON string with context + metadata")
    print("  workflow.context dict holds all output variables after run")


if __name__ == "__main__":
    asyncio.run(main())
