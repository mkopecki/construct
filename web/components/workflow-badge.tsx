import { CheckCircle2, Circle } from "lucide-react";

export function WorkflowBadge({ hasWorkflow }: { hasWorkflow: boolean }) {
  return hasWorkflow ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
      <CheckCircle2 className="h-3 w-3" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-white/[0.06]">
      <Circle className="h-3 w-3" />
      Draft
    </span>
  );
}
