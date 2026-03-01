import type { RunStatus } from "@/lib/types";
import { CheckCircle2, XCircle, Clock, Loader2, Ban } from "lucide-react";

const styles: Record<RunStatus, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  pending: { icon: Clock, color: "text-zinc-400", bg: "bg-zinc-500/10 ring-zinc-500/20" },
  running: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/10 ring-blue-500/20" },
  passed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 ring-emerald-500/20" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10 ring-red-500/20" },
  cancelled: { icon: Ban, color: "text-yellow-400", bg: "bg-yellow-500/10 ring-yellow-500/20" },
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const config = styles[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${config.color} ${config.bg} ring-1`}>
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {status}
    </span>
  );
}
