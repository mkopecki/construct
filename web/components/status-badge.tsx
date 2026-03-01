import { Badge } from "@/components/ui/badge";
import type { RunStatus } from "@/lib/types";

const styles: Record<RunStatus, string> = {
  pending: "bg-zinc-100 text-zinc-600 hover:bg-zinc-100",
  running: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  passed: "bg-green-100 text-green-700 hover:bg-green-100",
  failed: "bg-red-100 text-red-700 hover:bg-red-100",
  cancelled: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
};

export function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <Badge variant="secondary" className={styles[status]}>
      {status}
    </Badge>
  );
}
