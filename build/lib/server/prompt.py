from __future__ import annotations

from typing import Any


def build_generation_prompt(
    name: str,
    description: str,
    start_url: str,
    steps: list[dict[str, Any]],
    variables: list[dict[str, Any]],
    output_schema: list[dict[str, Any]],
) -> str:
    lines = [f"Task: {name}"]
    if description:
        lines.append(f"Description: {description}")
    lines.append(f"\nStart URL: {start_url}")

    if steps:
        lines.append("\nSteps:")
        for i, step in enumerate(steps, 1):
            desc = step.get("description", step.get("text", ""))
            lines.append(f"{i}. {desc}")

    if output_schema:
        lines.append(f"{len(steps) + 1}. Extract the expected output data from the page")

    if variables:
        lines.append("\nVariables:")
        for var in variables:
            example = f' (e.g., "{var["example"]}")' if var.get("example") else ""
            lines.append(f'- {var["name"]}: {var.get("description", "")}{example}')

    if output_schema:
        lines.append("\nExpected Output:")
        for field in output_schema:
            example = f' e.g., "{field["example"]}"' if field.get("example") else ""
            lines.append(f"- {field['name']}: {field.get('type', 'string')}{example}")

    return "\n".join(lines)
