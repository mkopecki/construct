import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { SOPSummary } from "@/lib/types";
import { ArrowUpRight, Circle, CheckCircle2 } from "lucide-react";

export function SOPCard({ sop }: { sop: SOPSummary }) {
  return (
    <Link href={`/sops/${sop.id}`}>
      <div className="group relative rounded-xl border border-white/[0.06] bg-card p-5 transition-all duration-200 hover:border-white/[0.1] hover:bg-[#16161a]">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {sop.has_workflow ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {sop.has_workflow ? "Active" : "Draft"}
            </span>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-amber transition-colors" />
        </div>

        <h3 className="text-[15px] font-medium text-foreground/90 mb-1.5 line-clamp-1">
          {sop.name || "Untitled workflow"}
        </h3>

        <p className="text-[13px] text-muted-foreground/70 line-clamp-2 mb-4 min-h-[2.6em]">
          {sop.description || "No description"}
        </p>

        <div className="pt-3 border-t border-white/[0.04]">
          <p className="text-[11px] font-mono text-muted-foreground/40">
            {formatDate(sop.updated_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
