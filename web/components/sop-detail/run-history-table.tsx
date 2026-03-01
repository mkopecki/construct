"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDuration } from "@/lib/utils";
import { useRuns } from "@/lib/hooks";

export function RunHistoryTable({ sopId }: { sopId: string }) {
  const { data: runs, isLoading } = useRuns(sopId);

  if (isLoading) {
    return <div className="animate-pulse h-20 rounded-md bg-muted" />;
  }

  if (!runs || runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No runs yet.</p>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Run History</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Steps</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>
                  <Link href={`/runs/${run.id}`}>
                    <StatusBadge status={run.status} />
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  <Link href={`/runs/${run.id}`}>{formatDate(run.started_at)}</Link>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDuration(run.started_at, run.finished_at)}
                </TableCell>
                <TableCell className="text-sm">
                  {run.current_step}/{run.total_steps}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
