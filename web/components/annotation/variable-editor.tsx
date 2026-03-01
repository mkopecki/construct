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
    <div className="space-y-2">
      <label className="text-sm font-medium">Variables</label>
      {variables.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2 text-xs text-muted-foreground">
          <span>Name</span>
          <span>Description</span>
          <span>Example</span>
          <span />
        </div>
      )}
      {variables.map((v, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2">
          <Input
            value={v.name}
            onChange={(e) => update(i, "name", e.target.value)}
            placeholder="variable_name"
          />
          <Input
            value={v.description}
            onChange={(e) => update(i, "description", e.target.value)}
            placeholder="What is this?"
          />
          <Input
            value={v.example}
            onChange={(e) => update(i, "example", e.target.value)}
            placeholder="example value"
          />
          <Button variant="ghost" size="icon" onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" />
        Add variable
      </Button>
    </div>
  );
}
