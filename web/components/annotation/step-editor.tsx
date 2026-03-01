"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { StepDef } from "@/lib/types";

interface StepEditorProps {
  steps: StepDef[];
  onChange: (steps: StepDef[]) => void;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function StepEditor({ steps, onChange }: StepEditorProps) {
  const move = (index: number, dir: -1 | 1) => {
    const next = [...steps];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const update = (index: number, description: string) => {
    const next = [...steps];
    next[index] = { ...next[index], description };
    onChange(next);
  };

  const add = () => {
    onChange([...steps, { id: genId(), description: "" }]);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Steps</label>
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2">
          <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
          <Input
            value={step.description}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Describe this step..."
            className="flex-1"
          />
          <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => move(i, 1)}
            disabled={i === steps.length - 1}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" />
        Add step
      </Button>
    </div>
  );
}
