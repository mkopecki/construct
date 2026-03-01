"use client";

import Link from "next/link";
import { formatDate, formatDuration } from "@/lib/utils";
import { useRuns } from "@/lib/hooks";
import { CheckCircle2, XCircle, Clock, Loader2, Ban, ArrowUpRight } from "lucide-react";
import type { RunStatus } from "@/lib/types";

const statusConfig: Record<RunStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-zinc-400", label: "Pending" },
  running: { icon: Loader2, color: "text-blue-400", label: "Running" },
  passed: { icon: CheckCircle2, color: "text-emerald-400", label: "Passed" },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
  cancelled: { icon: Ban, color: "text-yellow-400", label: "Cancelled" },
};

export function RunHistoryTable({ sopId }: { sopId: string }) {
  const { data: runs, isLoading } = useRuns(sopId);

  if (isLoading) {
    return <div className="h-20 skeleton-shimmer rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider">
        Run History
      </h3>

      {(!runs || runs.length === 0) ? (
        <p className="text-sm text-muted-foreground/50 py-4">No runs yet.</p>
      ) : (
        <div className="space-y-1">
          {runs.map((run) => {
            const config = statusConfig[run.status];
            const Icon = config.icon;

            return (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="group flex items-center justify-between rounded-lg px-3 py-2.5 -mx-3 transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${config.color} ${run.status === "running" ? "animate-spin" : ""}`} />
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground/40">
                      {formatDate(run.started_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-muted-foreground/30">
                    {run.current_step}/{run.total_steps} steps
                  </span>
                  <span className="text-xs text-muted-foreground/30">
                    {formatDuration(run.started_at, run.finished_at)}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-amber transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
