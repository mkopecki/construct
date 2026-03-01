import { Badge } from "@/components/ui/badge";

export function WorkflowBadge({ hasWorkflow }: { hasWorkflow: boolean }) {
  return hasWorkflow ? (
    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
      Ready
    </Badge>
  ) : (
    <Badge variant="secondary" className="bg-zinc-100 text-zinc-500 hover:bg-zinc-100">
      Draft
    </Badge>
  );
}
