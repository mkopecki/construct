"use client";

import { use, useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSOP, useUpdateSOP, useDeleteSOP } from "@/lib/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { streamGenerate } from "@/lib/sse";
import { eventToStepDescription } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { WorkflowBadge } from "@/components/workflow-badge";
import { SSELogPanel } from "@/components/sse-log-panel";
import { ConfirmDialog } from "@/components/confirm-dialog";

import { StepEditor } from "@/components/annotation/step-editor";
import { VariableEditor } from "@/components/annotation/variable-editor";
import { OutputSchemaEditor } from "@/components/annotation/output-schema-editor";

import { RunForm } from "@/components/sop-detail/run-form";
import { RunHistoryTable } from "@/components/sop-detail/run-history-table";

import type { StepDef, Variable, OutputField, GenerationEvent } from "@/lib/types";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";

export default function SOPPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { data: sop, isLoading } = useSOP(id);
  const updateSOP = useUpdateSOP(id);
  const deleteSOP = useDeleteSOP(id);

  const hasWorkflow = sop?.workflow_json != null;

  // Annotation state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [outputSchema, setOutputSchema] = useState<OutputField[]>([]);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [genLogs, setGenLogs] = useState<string[]>([]);

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

  const handleGenerate = useCallback(async () => {
    // Save annotation first
    await updateSOP.mutateAsync({
      name,
      description,
      steps,
      variables,
      output_schema: outputSchema,
    });

    setGenerating(true);
    setGenLogs([]);

    try {
      await streamGenerate(id, (event: GenerationEvent) => {
        switch (event.type) {
          case "status":
            setGenLogs((l) => [...l, event.message]);
            break;
          case "step":
            setGenLogs((l) => [...l, `Step recorded`]);
            break;
          case "complete":
            setGenLogs((l) => [...l, "Workflow generated successfully!"]);
            break;
          case "error":
            setGenLogs((l) => [...l, `Error: ${event.message}`]);
            break;
        }
      });
    } catch (e) {
      setGenLogs((l) => [...l, `Error: ${(e as Error).message}`]);
    } finally {
      setGenerating(false);
      qc.invalidateQueries({ queryKey: ["sops", id] });
    }
  }, [id, name, description, steps, variables, outputSchema, updateSOP, qc]);

  const handleDelete = useCallback(async () => {
    await deleteSOP.mutateAsync();
    router.push("/");
  }, [deleteSOP, router]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!sop) {
    return <p className="text-sm text-muted-foreground">SOP not found.</p>;
  }

  // ── Detail + Run Mode ──
  if (hasWorkflow) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{sop.name || "Untitled SOP"}</h1>
              <WorkflowBadge hasWorkflow />
            </div>
            {sop.description && (
              <p className="mt-1 text-sm text-muted-foreground">{sop.description}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Created {formatDate(sop.created_at)}
            </p>
          </div>
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            }
            title="Delete SOP"
            description="This will permanently delete this SOP and all its runs. This action cannot be undone."
            onConfirm={handleDelete}
            destructive
          />
        </div>

        {sop.variables && sop.variables.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Variables</h3>
            <div className="rounded-md border p-3 text-sm">
              {sop.variables.map((v) => (
                <div key={v.name} className="flex gap-4">
                  <span className="font-mono text-xs">{v.name}</span>
                  <span className="text-muted-foreground">{v.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <RunForm sopId={id} variables={sop.variables ?? []} />

        <Separator />

        <RunHistoryTable sopId={id} />
      </div>
    );
  }

  // ── Annotation Mode ──
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back
      </Button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Annotate SOP</h1>
        <WorkflowBadge hasWorkflow={false} />
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SOP name" />
        </div>

        <div className="space-y-1">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this workflow do?"
            rows={2}
          />
        </div>

        <Separator />
        <StepEditor steps={steps} onChange={setSteps} />

        <Separator />
        <VariableEditor variables={variables} onChange={setVariables} />

        <Separator />
        <OutputSchemaEditor fields={outputSchema} onChange={setOutputSchema} />

        <Separator />

        <Button onClick={handleGenerate} disabled={generating || steps.length === 0}>
          <Sparkles className="mr-1 h-4 w-4" />
          {generating ? "Generating..." : "Generate Workflow"}
        </Button>

        {genLogs.length > 0 && <SSELogPanel logs={genLogs} streaming={generating} />}
      </div>
    </div>
  );
}
