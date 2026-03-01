# Phase 1: Spike the Unknowns

Timebox: ~2 hours. The goal is to validate (or kill) the core integration assumptions before writing any product code.

## Spike 1: Programmatic workflow generation

**Question:** Can we call workflow-use's generation mode from Python code with a prompt string and get a workflow back?

**Steps:**
- [ ] Clone `browser-use/workflow-use`, read the source for `HealingService` and generation mode entry points
- [ ] Identify the Python API: is it `Workflow.generate()`, a CLI wrapper, or something else?
- [ ] Write a minimal script that takes a hardcoded prompt (e.g., "go to example.com, click the 'More information' link") and produces a workflow
- [ ] Determine: does generation mode require a running browser? Headless ok? What dependencies does it pull in?

**Pass criteria:** We can call a Python function with a string prompt and get a workflow object/JSON back, headless, without manual intervention.

**Fail plan:** If generation mode is CLI-only or tightly coupled to their UI, we subprocess it. If it fundamentally can't work headless, we pivot to recording-only mode using their recorder directly.

---

## Spike 2: Workflow JSON schema

**Question:** What does a generated workflow actually look like? What's the schema we need to store and display?

**Steps:**
- [ ] Generate 2-3 workflows from different prompts (simple navigation, form fill, multi-step)
- [ ] Diff the JSON outputs — identify the stable structure vs. variable parts
- [ ] Document the schema: what are the top-level fields? How are steps represented? Where do variables live?
- [ ] Check: does the JSON reference DOM selectors, coordinates, or semantic descriptions?

**Pass criteria:** We have a clear, documented schema we can map to our data model (SOP → steps, variables, outputs).

**Fail plan:** If the schema is opaque or unstable across runs, we treat the workflow JSON as an opaque blob and only parse the parts we need for display.

---

## Spike 3: Structured data extraction

**Question:** Can workflow-use return structured output data (e.g., `{ "price": "$549", "in_stock": true }`) from a workflow run?

**Steps:**
- [ ] Read the source for `workflow.run_as_tool()` and `workflow.run_with_no_ai()` — what do they return?
- [ ] Check if there's a built-in extraction step type, or if we need to add an LLM call at the end
- [ ] Try a workflow that navigates to a product page and extracts 2-3 fields
- [ ] Determine: does the output come back structured, or as free text that we'd need to parse?

**Pass criteria:** We can get key-value output from a workflow run, either natively or by appending an extraction step to the generated workflow.

**Fail plan:** If workflow-use has no extraction support, we add a final step that screenshots the page and uses an LLM to extract data against the user-defined output schema. More expensive but workable.

---

## Spike 4: Run lifecycle and timing

**Question:** How long does a workflow run take, and can we get step-by-step progress?

**Steps:**
- [ ] Time a few workflow runs end-to-end (simple 3-step, moderate 6-step)
- [ ] Check if workflow-use emits events/callbacks per step, or only returns when fully complete
- [ ] Determine: can we stream progress to the frontend, or is it fire-and-wait?

**Pass criteria:** We know the typical run duration and whether we can show per-step progress.

**Fail plan:** If no progress events, we show a spinner with "running..." and return results when done. For MCP, we block until complete (acceptable for hackathon if runs are under ~60s).

---

## After Spikes

With answers to all four, we'll know:
1. The exact Python API to call from our FastAPI backend
2. The data model for workflows, runs, and outputs
3. Whether extraction is native or needs a bolt-on
4. Whether the UX is real-time progress or fire-and-wait

Then we write the Phase 2 build plan.
