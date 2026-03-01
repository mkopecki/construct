// ── Recorded Events ──

export interface RecordedEvent {
  type: string;
  url?: string;
  timestamp?: number;
  selector?: string;
  value?: string;
  key?: string;
  text?: string;
  [key: string]: unknown;
}

// ── SOPs ──

export interface SOPSummary {
  id: string;
  name: string;
  description: string;
  has_workflow: boolean;
  created_at: string;
  updated_at: string;
}

export interface SOPDetail {
  id: string;
  name: string;
  description: string;
  recorded_events: RecordedEvent[];
  steps: StepDef[];
  variables: Variable[];
  output_schema: OutputField[];
  workspace_id: string | null;
  workflow_md: string | null;
  data_target: DataTarget | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateSOPRequest {
  name?: string;
  description?: string;
  steps?: StepDef[];
  variables?: Variable[];
  output_schema?: OutputField[];
}

export interface StepDef {
  id: string;
  description: string;
}

export interface Variable {
  name: string;
  description: string;
  example: string;
}

export interface OutputField {
  name: string;
  type: "string" | "number" | "integer" | "boolean";
  example: string;
}

// ── Data Targets ──

export type DataTargetType = "discord_webhook" | "slack" | "email" | "http_webhook";

export interface DataTarget {
  type: DataTargetType;
  enabled: boolean;
}

// ── Runs ──

export interface RunSummary {
  id: string;
  sop_id: string;
  status: RunStatus;
  current_step: number;
  total_steps: number;
  live_url: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface StepResult {
  step: number;
  status: "passed" | "failed";
  error?: string;
}

export interface RunDetail {
  id: string;
  sop_id: string;
  params: Record<string, unknown>;
  status: RunStatus;
  current_step: number;
  total_steps: number;
  step_results: StepResult[];
  output: Record<string, unknown> | null;
  error: string | null;
  session_id: string | null;
  live_url: string | null;
  cost_usd: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export type RunStatus = "pending" | "running" | "passed" | "failed" | "cancelled";

// ── SSE Events ──

export interface GenerationStatusEvent {
  type: "status";
  message: string;
}

export interface GenerationStepEvent {
  type: "step";
  [key: string]: unknown;
}

export interface GenerationCompleteEvent {
  type: "complete";
  workspace_id: string;
}

export interface GenerationErrorEvent {
  type: "error";
  message: string;
}

export type GenerationEvent =
  | GenerationStatusEvent
  | GenerationStepEvent
  | GenerationCompleteEvent
  | GenerationErrorEvent;

export interface RunStartedEvent {
  type: "run_started";
  run_id: string;
  live_url?: string;
}

export interface RunStatusEvent {
  type: "status";
  message: string;
}

export interface RunStepStartEvent {
  type: "step_start";
  step: number;
  total: number;
}

export interface RunStepCompleteEvent {
  type: "step_complete";
  step: number;
  total: number;
}

export interface RunCompleteEvent {
  type: "complete";
  run_id: string;
  output: Record<string, unknown> | null;
}

export interface RunCancelledEvent {
  type: "cancelled";
  run_id: string;
  step: number;
}

export interface RunErrorEvent {
  type: "error";
  message: string;
  step?: number;
}

export type RunEvent =
  | RunStartedEvent
  | RunStatusEvent
  | RunStepStartEvent
  | RunStepCompleteEvent
  | RunCompleteEvent
  | RunCancelledEvent
  | RunErrorEvent;
