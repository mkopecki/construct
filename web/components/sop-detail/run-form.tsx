"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { streamRun } from "@/lib/sse";
import { api } from "@/lib/api";
import type { Variable, RunEvent } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Square, ExternalLink, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface RunFormProps {
  sopId: string;
  variables: Variable[];
}

export function RunForm({ sopId, variables }: RunFormProps) {
  const qc = useQueryClient();
  const [params, setParams] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const v of variables) init[v.name] = v.example ?? "";
    return init;
  });

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [stepProgress, setStepProgress] = useState<{ current: number; total: number } | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [output, setOutput] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setStatus("Starting...");
    setStepProgress(null);
    setLiveUrl(null);
    setOutput(null);
    setError(null);
    setDone(false);
    runIdRef.current = null;

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamRun(sopId, params, (event: RunEvent) => {
        switch (event.type) {
          case "run_started":
            runIdRef.current = event.run_id;
            if (event.live_url) setLiveUrl(event.live_url);
            setStatus("Session created");
            break;
          case "status":
            setStatus(event.message);
            break;
          case "step_start":
            setStepProgress({ current: event.step, total: event.total });
            setStatus(`Step ${event.step} of ${event.total}`);
            break;
          case "step_complete":
            setStepProgress({ current: event.step, total: event.total });
            break;
          case "complete":
            setOutput(event.output ?? null);
            setStatus("Completed");
            setDone(true);
            break;
          case "cancelled":
            setStatus(`Cancelled at step ${event.step}`);
            break;
          case "error":
            setError(event.message);
            break;
        }
      }, ac.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
      qc.invalidateQueries({ queryKey: ["runs", { sopId }] });
    }
  }, [sopId, params, qc]);

  const handleCancel = useCallback(async () => {
    if (runIdRef.current) {
      try { await api.cancelRun(runIdRef.current); } catch { abortRef.current?.abort(); }
    } else {
      abortRef.current?.abort();
    }
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider">
          Run Workflow
        </h3>
        {running && liveUrl && (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-amber hover:text-amber/80 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Watch live
          </a>
        )}
      </div>

      {variables.length > 0 && (
        <div className="space-y-3">
          {variables.map((v) => (
            <div key={v.name} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                <span className="font-mono text-amber/70">{v.name}</span>
                {v.description && (
                  <span className="ml-2 font-normal text-muted-foreground/50">
                    {v.description}
                  </span>
                )}
              </Label>
              <Input
                value={params[v.name] ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, [v.name]: e.target.value }))}
                placeholder={v.example || v.name}
                className="bg-secondary border-white/[0.06] focus:border-amber/30"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          onClick={handleRun}
          disabled={running}
          className="bg-amber text-amber-foreground hover:bg-amber/90"
        >
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {running ? "Running..." : "Run"}
        </Button>
        {running && (
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-white/[0.06]"
          >
            <Square className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>

      {/* Progress */}
      {running && stepProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{status}</span>
            <span className="font-mono text-muted-foreground/70">
              {stepProgress.current}/{stepProgress.total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-amber progress-active transition-all duration-500"
              style={{ width: `${(stepProgress.current / stepProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {running && !stepProgress && status && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-amber" />
          {status}
        </div>
      )}

      {/* Success */}
      {done && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Run completed successfully
          </div>
          {output && Object.keys(output).length > 0 && (
            <div className="space-y-1 pt-1">
              {Object.entries(output).map(([k, v]) => (
                <div key={k} className="flex gap-3 text-xs">
                  <span className="font-mono text-muted-foreground min-w-[100px]">{k}</span>
                  <span className="text-foreground/80">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && !running && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
