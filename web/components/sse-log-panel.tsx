"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SSELogPanelProps {
  logs: string[];
  streaming?: boolean;
}

export function SSELogPanel({ logs, streaming }: SSELogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <ScrollArea className="h-64 rounded-md border bg-zinc-950 p-4 font-mono text-xs text-zinc-300">
      <div className="space-y-0.5">
        {logs.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {streaming && (
          <div className="animate-pulse text-zinc-500">Streaming...</div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
