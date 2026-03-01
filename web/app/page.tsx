"use client";

import { useSOPs } from "@/lib/hooks";
import { SOPCard } from "@/components/sop-card";
import { FileText } from "lucide-react";

export default function DashboardPage() {
  const { data: sops, isLoading } = useSOPs();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">SOPs</h1>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {sops && sops.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No SOPs yet. Record a workflow using the browser extension.
          </p>
        </div>
      )}

      {sops && sops.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sops.map((sop) => (
            <SOPCard key={sop.id} sop={sop} />
          ))}
        </div>
      )}
    </div>
  );
}
