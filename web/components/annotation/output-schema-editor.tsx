"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import type { OutputField } from "@/lib/types";

interface OutputSchemaEditorProps {
  fields: OutputField[];
  onChange: (fields: OutputField[]) => void;
}

const TYPES: OutputField["type"][] = ["string", "number", "integer", "boolean"];

export function OutputSchemaEditor({ fields, onChange }: OutputSchemaEditorProps) {
  const update = (index: number, field: keyof OutputField, value: string) => {
    const next = [...fields];
    next[index] = { ...next[index], [field]: value } as OutputField;
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...fields, { name: "", type: "string", example: "" }]);
  };

  return (
    <div className="space-y-3">
      <label className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider">Output Schema</label>
      {fields.length > 0 && (
        <div className="grid grid-cols-[1fr_100px_1fr_36px] gap-2 text-[10px] font-mono text-muted-foreground/30 uppercase tracking-wider">
          <span>Field name</span>
          <span>Type</span>
          <span>Example</span>
          <span />
        </div>
      )}
      {fields.map((f, i) => (
        <div key={i} className="group grid grid-cols-[1fr_100px_1fr_36px] gap-2">
          <Input
            value={f.name}
            onChange={(e) => update(i, "name", e.target.value)}
            placeholder="field_name"
            className="bg-secondary border-white/[0.06] focus:border-amber/30 font-mono text-xs"
          />
          <select
            value={f.type}
            onChange={(e) => update(i, "type", e.target.value)}
            className="rounded-md border border-white/[0.06] bg-secondary px-3 py-2 text-xs text-foreground/80 focus:border-amber/30 focus:outline-none"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Input
            value={f.example}
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
        Add field
      </Button>
    </div>
  );
}
