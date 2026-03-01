"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepProgress } from "@/components/step-progress";
import { SSELogPanel } from "@/components/sse-log-panel";
import { KeyValueTable } from "@/components/key-value-table";
import { streamRun } from "@/lib/sse";
import { api } from "@/lib/api";
import type { Variable, RunEvent } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Square } from "lucide-react";

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
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [failedStep, setFailedStep] = useState<number | undefined>();
  const [output, setOutput] = useState<Record<string, unknown> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setLogs([]);
    setCurrentStep(0);
    setTotalSteps(0);
    setCompletedSteps(new Set());
    setFailedStep(undefined);
    setOutput(null);
    runIdRef.current = null;

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamRun(sopId, params, (event: RunEvent) => {
        switch (event.type) {
          case "run_started":
            runIdRef.current = event.run_id;
            setTotalSteps(event.total_steps);
            setLogs((l) => [...l, `Run started (${event.total_steps} steps)`]);
            break;
          case "step_start":
            setCurrentStep(event.step);
            setLogs((l) => [...l, `Step ${event.step}/${event.total} starting...`]);
            break;
          case "step_complete":
            setCompletedSteps((s) => new Set(s).add(event.step));
            setLogs((l) => [...l, `Step ${event.step}/${event.total} complete`]);
            break;
          case "complete":
            setOutput(event.output ?? null);
            setLogs((l) => [...l, "Run completed successfully"]);
            break;
          case "cancelled":
            setLogs((l) => [...l, `Run cancelled at step ${event.step}`]);
            break;
          case "error":
            if (event.step) setFailedStep(event.step);
            setLogs((l) => [...l, `Error: ${event.message}`]);
            break;
        }
      }, ac.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setLogs((l) => [...l, `Error: ${(e as Error).message}`]);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
      qc.invalidateQueries({ queryKey: ["runs", { sopId }] });
    }
  }, [sopId, params, qc]);

  const handleCancel = useCallback(async () => {
    if (runIdRef.current) {
      try {
        await api.cancelRun(runIdRef.current);
      } catch {
        // abort the stream directly as fallback
        abortRef.current?.abort();
      }
    } else {
      abortRef.current?.abort();
    }
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Run Workflow</h3>

      {variables.length > 0 && (
        <div className="space-y-3">
          {variables.map((v) => (
            <div key={v.name} className="space-y-1">
              <Label className="text-xs">
                {v.name}
                {v.description && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    — {v.description}
                  </span>
                )}
              </Label>
              <Input
                value={params[v.name] ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, [v.name]: e.target.value }))}
                placeholder={v.example || v.name}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleRun} disabled={running}>
          <Play className="mr-1 h-4 w-4" />
          Run
        </Button>
        {running && (
          <Button variant="outline" onClick={handleCancel}>
            <Square className="mr-1 h-4 w-4" />
            Cancel
          </Button>
        )}
      </div>

      {(logs.length > 0 || running) && (
        <div className="space-y-3">
          {totalSteps > 0 && (
            <StepProgress
              currentStep={currentStep}
              totalSteps={totalSteps}
              completedSteps={completedSteps}
              failedStep={failedStep}
            />
          )}
          <SSELogPanel logs={logs} streaming={running} />
        </div>
      )}

      {output && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Output</h4>
          <KeyValueTable data={output} />
        </div>
      )}
    </div>
  );
}
