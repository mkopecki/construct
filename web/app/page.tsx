"use client";

import { useSOPs } from "@/lib/hooks";
import { SOPCard } from "@/components/sop-card";
import { Layers } from "lucide-react";

export default function DashboardPage() {
  const { data: sops, isLoading } = useSOPs();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-display text-3xl text-foreground/95">Workflows</h1>
        <p className="text-sm text-muted-foreground">
          Recorded automations ready to run on autopilot.
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-lg skeleton-shimmer"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}

      {sops && sops.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.06] py-20 text-center">
          <div className="mb-4 rounded-lg bg-secondary p-3">
            <Layers className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground max-w-[260px]">
            No workflows yet. Record one using the browser extension.
          </p>
        </div>
      )}

      {sops && sops.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sops.map((sop, i) => (
            <div
              key={sop.id}
              className="animate-in-up"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <SOPCard sop={sop} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
