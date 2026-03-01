"use client";

import { use, useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSOP, useUpdateSOP, useDeleteSOP } from "@/lib/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { streamGenerate, streamRun } from "@/lib/sse";
import { eventToStepDescription } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";

import { StepEditor } from "@/components/annotation/step-editor";
import { VariableEditor } from "@/components/annotation/variable-editor";
import { OutputSchemaEditor } from "@/components/annotation/output-schema-editor";

import { RunForm } from "@/components/sop-detail/run-form";
import { RunHistoryTable } from "@/components/sop-detail/run-history-table";
import { WizardSteps } from "@/components/sop-detail/wizard-steps";

import { api } from "@/lib/api";
import type { StepDef, Variable, OutputField, GenerationEvent, RunEvent, DataTargetType } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Trash2,
  Play,
  Square,
  ExternalLink,
  CheckCircle2,
  XCircle,
  SkipForward,
  Bell,
  Loader2,
} from "lucide-react";

const WIZARD_STEPS = ["Define", "Verify", "Targets"];

export default function SOPPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { data: sop, isLoading } = useSOP(id);
  const updateSOP = useUpdateSOP(id);
  const deleteSOP = useDeleteSOP(id);

  const hasWorkflow = sop?.workspace_id != null;

  // Annotation state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [outputSchema, setOutputSchema] = useState<OutputField[]>([]);

  // Wizard state
  const [wizardStep, setWizardStep] = useState(0);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genDone, setGenDone] = useState(false);

  // Verify run state
  const [verifyRunning, setVerifyRunning] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [verifyStepProgress, setVerifyStepProgress] = useState<{ current: number; total: number } | null>(null);
  const [verifyOutput, setVerifyOutput] = useState<Record<string, unknown> | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLiveUrl, setVerifyLiveUrl] = useState<string | null>(null);
  const [verifyDone, setVerifyDone] = useState(false);
  const verifyRunIdRef = useState<string | null>(null);
  const verifyAbortRef = useState<AbortController | null>(null);

  // Data target state
  const [selectedTarget, setSelectedTarget] = useState<DataTargetType | null>("discord_webhook");

  // Seed form from SOP data
  const seeded = useMemo(() => sop?.id, [sop?.id]);
  useEffect(() => {
    if (!sop) return;
    setName(sop.name);
    setDescription(sop.description);
    setVariables(sop.variables ?? []);
    setOutputSchema(sop.output_schema ?? []);

    if (sop.steps && sop.steps.length > 0) {
      setSteps(sop.steps);
    } else if (sop.recorded_events && sop.recorded_events.length > 0) {
      setSteps(
        sop.recorded_events.map((e, i) => ({
          id: `evt-${i}`,
          description: eventToStepDescription(e),
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded]);

  // ── Step 1: Generate ──
  const handleGenerate = useCallback(async () => {
    await updateSOP.mutateAsync({
      name,
      description,
      steps,
      variables,
      output_schema: outputSchema,
    });

    setGenerating(true);
    setGenStatus("Initializing...");
    setGenError(null);
    setGenDone(false);

    try {
      await streamGenerate(id, (event: GenerationEvent) => {
        switch (event.type) {
          case "status":
            setGenStatus(event.message);
            break;
          case "step":
            setGenStatus("Recording steps...");
            break;
          case "complete":
            setGenStatus("Workflow generated");
            setGenDone(true);
            break;
          case "error":
            setGenError(event.message);
            break;
        }
      });
    } catch (e) {
      setGenError((e as Error).message);
    } finally {
      setGenerating(false);
      qc.invalidateQueries({ queryKey: ["sops", id] });
    }
  }, [id, name, description, steps, variables, outputSchema, updateSOP, qc]);

  // ── Step 2: Verify run ──
  const handleVerifyRun = useCallback(async () => {
    setVerifyRunning(true);
    setVerifyStatus("Starting verification run...");
    setVerifyStepProgress(null);
    setVerifyOutput(null);
    setVerifyError(null);
    setVerifyLiveUrl(null);
    setVerifyDone(false);

    const ac = new AbortController();
    verifyAbortRef[1](ac);

    const params: Record<string, string> = {};
    for (const v of variables) params[v.name] = v.example ?? "";

    try {
      await streamRun(id, params, (event: RunEvent) => {
        switch (event.type) {
          case "run_started":
            verifyRunIdRef[1](event.run_id);
            if (event.live_url) setVerifyLiveUrl(event.live_url);
            setVerifyStatus("Session created");
            break;
          case "status":
            setVerifyStatus(event.message);
            break;
          case "step_start":
            setVerifyStepProgress({ current: event.step, total: event.total });
            setVerifyStatus(`Running step ${event.step} of ${event.total}`);
            break;
          case "step_complete":
            setVerifyStepProgress({ current: event.step, total: event.total });
            break;
          case "complete":
            setVerifyOutput(event.output ?? null);
            setVerifyStatus("Verification complete");
            setVerifyDone(true);
            break;
          case "cancelled":
            setVerifyStatus("Run cancelled");
            break;
          case "error":
            setVerifyError(event.message);
            break;
        }
      }, ac.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setVerifyError((e as Error).message);
      }
    } finally {
      setVerifyRunning(false);
      verifyAbortRef[1](null);
      qc.invalidateQueries({ queryKey: ["runs", { sopId: id }] });
    }
  }, [id, variables, qc, verifyAbortRef, verifyRunIdRef]);

  const handleCancelVerify = useCallback(async () => {
    const runId = verifyRunIdRef[0];
    if (runId) {
      try { await api.cancelRun(runId); } catch { verifyAbortRef[0]?.abort(); }
    } else {
      verifyAbortRef[0]?.abort();
    }
  }, [verifyRunIdRef, verifyAbortRef]);

  // ── Step 3: Data targets ──
  const handleDataTargetConfirm = useCallback(async () => {
    if (selectedTarget) {
      await api.setDataTarget(id, { type: selectedTarget, enabled: true });
    }
    qc.invalidateQueries({ queryKey: ["sops", id] });
    router.push(`/sops/${id}`);
  }, [id, selectedTarget, qc, router]);

  const handleDelete = useCallback(async () => {
    await deleteSOP.mutateAsync();
    router.push("/");
  }, [deleteSOP, router]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton-shimmer rounded-lg" />
        <div className="h-64 skeleton-shimmer rounded-lg" />
      </div>
    );
  }

  if (!sop) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Workflow not found.</p>
      </div>
    );
  }

  // ── Ready Mode (has workflow) ──
  if (hasWorkflow) {
    return <ReadyView sop={sop} sopId={id} onDelete={handleDelete} />;
  }

  // ── Wizard Mode (draft) ──
  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <div className="space-y-1">
        <h1 className="font-display text-3xl text-foreground/95">Set up workflow</h1>
        <p className="text-sm text-muted-foreground">
          Define, verify, and configure your automation.
        </p>
      </div>

      <WizardSteps current={wizardStep} steps={WIZARD_STEPS} />

      {/* ── Step 1: Define ── */}
      {wizardStep === 0 && (
        <div className="animate-in-up space-y-6">
          <div className="rounded-xl border border-white/[0.06] bg-card p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Scrape product prices"
                className="bg-secondary border-white/[0.06] focus:border-amber/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this workflow do?"
                rows={2}
                className="bg-secondary border-white/[0.06] focus:border-amber/30 resize-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-card p-6">
            <StepEditor steps={steps} onChange={setSteps} />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-card p-6">
            <VariableEditor variables={variables} onChange={setVariables} />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-card p-6">
            <OutputSchemaEditor fields={outputSchema} onChange={setOutputSchema} />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div />
            <Button
              onClick={async () => {
                if (!genDone) await handleGenerate();
                if (!genError) setWizardStep(1);
              }}
              disabled={generating || steps.length === 0}
              className="bg-amber text-amber-foreground hover:bg-amber/90 h-10 px-5"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {genStatus || "Generating..."}
                </>
              ) : genDone ? (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate & Continue
                </>
              )}
            </Button>
          </div>

          {genError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-400">{genError}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Verify ── */}
      {wizardStep === 1 && (
        <div className="animate-in-up space-y-6">
          <div className="rounded-xl border border-white/[0.06] bg-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground/90">Verification Run</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Run the workflow once to verify it works correctly.
                </p>
              </div>
              {verifyLiveUrl && verifyRunning && (
                <a
                  href={verifyLiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-amber hover:text-amber/80 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Watch live
                </a>
              )}
            </div>

            {!verifyRunning && !verifyDone && !verifyError && (
              <Button
                onClick={handleVerifyRun}
                className="bg-secondary text-foreground hover:bg-secondary/80 border border-white/[0.06]"
              >
                <Play className="mr-2 h-4 w-4" />
                Run verification
              </Button>
            )}

            {verifyRunning && (
              <div className="space-y-4">
                {verifyStepProgress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{verifyStatus}</span>
                      <span className="font-mono text-muted-foreground/70">
                        {verifyStepProgress.current}/{verifyStepProgress.total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber progress-active transition-all duration-500"
                        style={{ width: `${(verifyStepProgress.current / verifyStepProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                {!verifyStepProgress && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-amber" />
                    {verifyStatus}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelVerify}
                  className="border-white/[0.06]"
                >
                  <Square className="mr-1.5 h-3 w-3" />
                  Cancel
                </Button>
              </div>
            )}

            {verifyDone && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Verification passed
                </div>
                {verifyOutput && Object.keys(verifyOutput).length > 0 && (
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Output</p>
                    <div className="space-y-1">
                      {Object.entries(verifyOutput).map(([k, v]) => (
                        <div key={k} className="flex gap-3 text-xs">
                          <span className="font-mono text-muted-foreground min-w-[100px]">{k}</span>
                          <span className="text-foreground/80">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {verifyError && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <XCircle className="h-4 w-4" />
                  Verification failed
                </div>
                <p className="text-xs text-red-400/70">{verifyError}</p>
                <Button
                  onClick={handleVerifyRun}
                  size="sm"
                  className="bg-secondary text-foreground hover:bg-secondary/80 border border-white/[0.06]"
                >
                  <Play className="mr-1.5 h-3 w-3" />
                  Retry
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => setWizardStep(0)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setWizardStep(2)}
                className="text-muted-foreground hover:text-foreground"
              >
                <SkipForward className="mr-2 h-4 w-4" />
                Skip
              </Button>
              <Button
                onClick={() => setWizardStep(2)}
                disabled={verifyRunning}
                className="bg-amber text-amber-foreground hover:bg-amber/90 h-10 px-5"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Data Targets ── */}
      {wizardStep === 2 && (
        <div className="animate-in-up space-y-6">
          <div className="rounded-xl border border-white/[0.06] bg-card p-6 space-y-5">
            <div>
              <h3 className="text-sm font-medium text-foreground/90">Data Targets</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose where to send results when runs complete.
              </p>
            </div>

            <div className="space-y-2">
              {DATA_TARGET_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  disabled={!opt.enabled}
                  onClick={() => opt.enabled && setSelectedTarget(opt.type)}
                  className={`w-full rounded-lg border p-4 text-left transition-all ${
                    !opt.enabled
                      ? "cursor-not-allowed opacity-40 border-white/[0.04]"
                      : selectedTarget === opt.type
                        ? "border-amber/30 bg-amber/[0.04] glow-border"
                        : "border-white/[0.06] hover:border-white/[0.1]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedTarget === opt.type && opt.enabled
                            ? "border-amber"
                            : "border-white/[0.15]"
                        }`}
                      >
                        {selectedTarget === opt.type && opt.enabled && (
                          <div className="h-2 w-2 rounded-full bg-amber" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-foreground/90">{opt.label}</span>
                    </div>
                    {!opt.enabled && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="mt-1 ml-7 text-xs text-muted-foreground/70">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => setWizardStep(1)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ["sops", id] });
                  router.push(`/sops/${id}`);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip
              </Button>
              <Button
                onClick={handleDataTargetConfirm}
                className="bg-amber text-amber-foreground hover:bg-amber/90 h-10 px-5"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finish Setup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Data target options ──
const DATA_TARGET_OPTIONS: {
  type: DataTargetType;
  label: string;
  description: string;
  enabled: boolean;
}[] = [
  {
    type: "discord_webhook",
    label: "Discord Webhook",
    description: "Send a notification to a Discord channel when a run finishes",
    enabled: true,
  },
  {
    type: "slack",
    label: "Slack",
    description: "Post run results to a Slack channel",
    enabled: false,
  },
  {
    type: "email",
    label: "Email",
    description: "Send run results via email",
    enabled: false,
  },
  {
    type: "http_webhook",
    label: "HTTP Webhook",
    description: "POST run results to a custom URL",
    enabled: false,
  },
];

// ── Ready View (active workflow) ──
import type { SOPDetail } from "@/lib/types";

function ReadyView({ sop, sopId, onDelete }: { sop: SOPDetail; sopId: string; onDelete: () => void }) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <button
        onClick={() => router.push("/")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl text-foreground/95">
              {sop.name || "Untitled workflow"}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Active
            </span>
            {sop.data_target && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-2.5 py-0.5 text-[11px] font-medium text-amber ring-1 ring-amber/20">
                <Bell className="h-3 w-3" />
                {sop.data_target.type === "discord_webhook" ? "Discord" : sop.data_target.type}
              </span>
            )}
          </div>
          {sop.description && (
            <p className="text-sm text-muted-foreground max-w-xl">{sop.description}</p>
          )}
          <p className="text-[11px] font-mono text-muted-foreground/40">
            Created {formatDate(sop.created_at)}
          </p>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
          title="Delete workflow"
          description="This will permanently delete this workflow and all its runs."
          onConfirm={onDelete}
          destructive
        />
      </div>

      {/* Variables overview */}
      {sop.variables && sop.variables.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-card p-5">
          <h3 className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-3">
            Input Variables
          </h3>
          <div className="flex flex-wrap gap-2">
            {sop.variables.map((v) => (
              <div
                key={v.name}
                className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5"
              >
                <span className="font-mono text-xs text-amber">{v.name}</span>
                {v.description && (
                  <span className="text-xs text-muted-foreground">{v.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run section */}
      <div className="rounded-xl border border-white/[0.06] bg-card p-6">
        <RunForm sopId={sopId} variables={sop.variables ?? []} />
      </div>

      {/* History */}
      <div className="rounded-xl border border-white/[0.06] bg-card p-6">
        <RunHistoryTable sopId={sopId} />
      </div>
    </div>
  );
}
