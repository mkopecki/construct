"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import type { Variable } from "@/lib/types";

interface VariableEditorProps {
  variables: Variable[];
  onChange: (variables: Variable[]) => void;
}

export function VariableEditor({ variables, onChange }: VariableEditorProps) {
  const update = (index: number, field: keyof Variable, value: string) => {
    const next = [...variables];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(variables.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...variables, { name: "", description: "", example: "" }]);
  };

  return (
    <div className="space-y-3">
      <label className="block text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider">Variables</label>
      {variables.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_1fr_36px] gap-2 text-[10px] font-mono text-muted-foreground/30 uppercase tracking-wider">
          <span>Name</span>
          <span>Description</span>
          <span>Example</span>
          <span />
        </div>
      )}
      {variables.map((v, i) => (
        <div key={i} className="group grid grid-cols-[1fr_1fr_1fr_36px] gap-2">
          <Input
            value={v.name}
            onChange={(e) => update(i, "name", e.target.value)}
            placeholder="variable_name"
            className="bg-secondary border-white/[0.06] focus:border-amber/30 font-mono text-xs"
          />
          <Input
            value={v.description}
            onChange={(e) => update(i, "description", e.target.value)}
            placeholder="What is this?"
            className="bg-secondary border-white/[0.06] focus:border-amber/30"
          />
          <Input
            value={v.example}
            onChange={(e) => update(i, "example", e.target.value)}
            placeholder="example value"
            className="bg-secondary border-white/[0.06] focus:border-amber/30"
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
        Add variable
      </Button>
    </div>
  );
}
