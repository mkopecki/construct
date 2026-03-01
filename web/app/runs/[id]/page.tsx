"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useRun } from "@/lib/hooks";
import { formatDate, formatDuration } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { KeyValueTable } from "@/components/key-value-table";
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: run, isLoading } = useRun(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!run) {
    return <p className="text-sm text-muted-foreground">Run not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Run Detail</h1>
            <StatusBadge status={run.status} />
          </div>
          <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            <p>Started: {formatDate(run.started_at)}</p>
            <p>Finished: {formatDate(run.finished_at)}</p>
            <p>Duration: {formatDuration(run.started_at, run.finished_at)}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/sops/${run.sop_id}`)}
        >
          <RotateCcw className="mr-1 h-4 w-4" />
          Run Again
        </Button>
      </div>

      {run.params && Object.keys(run.params).length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Parameters</h3>
            <KeyValueTable data={run.params} />
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          Steps ({run.step_results.length}/{run.total_steps})
        </h3>
        <div className="space-y-1">
          {run.step_results.map((sr) => (
            <div key={sr.step} className="flex items-center gap-2 text-sm">
              {sr.status === "passed" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span>Step {sr.step}</span>
              {sr.error && (
                <span className="text-xs text-red-600">— {sr.error}</span>
              )}
            </div>
          ))}
          {run.step_results.length === 0 && (
            <p className="text-sm text-muted-foreground">No step results recorded.</p>
          )}
        </div>
      </div>

      {run.output && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Output</h3>
            <KeyValueTable data={run.output} />
          </div>
        </>
      )}

      {run.error && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-red-600">Error</h3>
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {run.error}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
