"""Build workflow.md and task prompts for Browser Use Cloud sessions."""

from __future__ import annotations

from typing import Any


def build_workflow_md(
    name: str,
    description: str,
    start_url: str,
    steps: list[dict[str, Any]],
    variables: list[dict[str, Any]],
    output_schema: list[dict[str, Any]],
) -> str:
    lines = [f"# {name}", ""]
    if description:
        lines += [description, ""]

    lines += ["## Start URL", "", f"`{start_url}`", ""]

    if variables:
        lines += ["## Variables", ""]
        for var in variables:
            example = f' (e.g., `{var["example"]}`)' if var.get("example") else ""
            desc = var.get("description", "")
            lines.append(f"- **{var['name']}**: {desc}{example}")
        lines.append("")

    if steps:
        lines += ["## Steps", ""]
        for i, step in enumerate(steps, 1):
            desc = step.get("description", step.get("text", ""))
            lines.append(f"{i}. {desc}")
        lines.append("")

    if output_schema:
        lines += ["## Expected Output", ""]
        lines += ["Return a JSON object with the following fields:", ""]
        lines.append("```json")
        lines.append("{")
        field_lines = []
        for field in output_schema:
            example = field.get("example", "")
            ftype = field.get("type", "string")
            if ftype in ("number", "integer"):
                field_lines.append(f'  "{field["name"]}": {example or 0}')
            elif ftype == "boolean":
                field_lines.append(f'  "{field["name"]}": {example.lower() if example else "false"}')
            else:
                field_lines.append(f'  "{field["name"]}": "{example}"')
        lines.append(",\n".join(field_lines))
        lines.append("}")
        lines.append("```")
        lines.append("")

    return "\n".join(lines)


def build_run_task_prompt(
    params: dict[str, Any],
    output_schema: list[dict[str, Any]],
) -> str:
    lines = [
        "Read `workflow.md` from the workspace and execute the workflow described in it.",
    ]

    if params:
        lines += ["", "Use these parameter values:"]
        for k, v in params.items():
            lines.append(f"- **{k}**: `{v}`")

    if output_schema:
        field_lines = []
        for f in output_schema:
            ftype = f.get("type", "string")
            example = f.get("example", "")
            if ftype in ("number", "integer"):
                field_lines.append(f'  "{f["name"]}": {example or 0}')
            else:
                field_lines.append(f'  "{f["name"]}": "{example}"')
        example_json = "{\n" + ",\n".join(field_lines) + "\n}"
        lines += [
            "",
            "IMPORTANT: After completing all steps, you MUST return the extracted data "
            "as a JSON object inside a fenced code block. This is required — do not "
            "return prose or a summary. Your final output MUST contain exactly this format:",
            "",
            "```json",
            example_json,
            "```",
            "",
            "Replace the example values with the actual data extracted from the page.",
        ]

    lines += [
        "",
        "If any step fails because the site has changed (e.g., a selector or layout "
        "is different), adapt to the new layout and complete the task. Then fully "
        "overwrite `workflow.md` in the workspace with the corrected version — do NOT "
        "append or patch, replace the entire file so it stays a single source of truth. "
        "Add a line at the end of your output: `_workflow_updated: true`.",
    ]

    return "\n".join(lines)
