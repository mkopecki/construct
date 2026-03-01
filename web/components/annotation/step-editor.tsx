"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GripVertical, Trash2, Plus } from "lucide-react";
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
    <div className="space-y-3">
      <label className="block text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider">Steps</label>
      {steps.map((step, i) => (
        <div key={step.id} className="group flex items-center gap-2">
          <button
            className="cursor-grab text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => move(i, i > 0 ? -1 : 1)}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="w-6 text-center text-[11px] font-mono text-muted-foreground/30">{i + 1}</span>
          <Input
            value={step.description}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Describe this step..."
            className="flex-1 bg-secondary border-white/[0.06] focus:border-amber/30"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove(i)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={add}
        className="border-dashed border-white/[0.06] text-muted-foreground hover:text-foreground hover:border-white/[0.12]"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add step
      </Button>
    </div>
  );
}
