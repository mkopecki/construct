"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useRun } from "@/lib/hooks";
import { formatDate, formatDuration } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Loader2,
  Ban,
} from "lucide-react";
import type { RunStatus } from "@/lib/types";

const statusConfig: Record<RunStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "text-zinc-400", bg: "bg-zinc-500/10 ring-zinc-500/20", label: "Pending" },
  running: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/10 ring-blue-500/20", label: "Running" },
  passed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 ring-emerald-500/20", label: "Passed" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10 ring-red-500/20", label: "Failed" },
  cancelled: { icon: Ban, color: "text-yellow-400", bg: "bg-yellow-500/10 ring-yellow-500/20", label: "Cancelled" },
};

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: run, isLoading } = useRun(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton-shimmer rounded-lg" />
        <div className="h-64 skeleton-shimmer rounded-lg" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Run not found.</p>
      </div>
    );
  }

  const config = statusConfig[run.status];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-8">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl text-foreground/95">Run Detail</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${config.color} ${config.bg} ring-1`}>
              <StatusIcon className={`h-3 w-3 ${run.status === "running" ? "animate-spin" : ""}`} />
              {config.label}
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/40">Started</span>
              <span className="font-mono">{formatDate(run.started_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/40">Duration</span>
              <span className="font-mono">{formatDuration(run.started_at, run.finished_at)}</span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/sops/${run.sop_id}`)}
          className="border-white/[0.06] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Run Again
        </Button>
      </div>

      {/* Parameters */}
      {run.params && Object.keys(run.params).length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-card p-5 space-y-3">
          <h3 className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider">
            Parameters
          </h3>
          <div className="space-y-1.5">
            {Object.entries(run.params).map(([k, v]) => (
              <div key={k} className="flex gap-3 text-xs">
                <span className="font-mono text-amber/70 min-w-[120px]">{k}</span>
                <span className="text-foreground/70">
                  {typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="rounded-xl border border-white/[0.06] bg-card p-5 space-y-3">
        <h3 className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider">
          Steps ({run.step_results.length}/{run.total_steps})
        </h3>

        {run.step_results.length === 0 ? (
          <p className="text-sm text-muted-foreground/50 py-2">No step results recorded.</p>
        ) : (
          <div className="space-y-1">
            {run.step_results.map((sr) => (
              <div
                key={sr.step}
                className="flex items-center gap-3 rounded-lg px-3 py-2 -mx-3"
              >
                {sr.status === "passed" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <span className="text-xs font-mono text-muted-foreground/50 w-12">
                  Step {sr.step}
                </span>
                {sr.error && (
                  <span className="text-xs text-red-400/70">{sr.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output */}
      {run.output && Object.keys(run.output).length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-card p-5 space-y-3">
          <h3 className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider">
            Output
          </h3>
          <div className="space-y-1.5">
            {Object.entries(run.output).map(([k, v]) => (
              <div key={k} className="flex gap-3 text-xs">
                <span className="font-mono text-amber/70 min-w-[120px]">{k}</span>
                <span className="text-foreground/70">
                  {typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {run.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">{run.error}</p>
        </div>
      )}
    </div>
  );
}
