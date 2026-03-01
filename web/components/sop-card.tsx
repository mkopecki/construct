import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { WorkflowBadge } from "@/components/workflow-badge";
import { formatDate } from "@/lib/utils";
import type { SOPSummary } from "@/lib/types";

export function SOPCard({ sop }: { sop: SOPSummary }) {
  return (
    <Link href={`/sops/${sop.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{sop.name || "Untitled SOP"}</CardTitle>
            <WorkflowBadge hasWorkflow={sop.has_workflow} />
          </div>
          <CardDescription className="line-clamp-2">
            {sop.description || "No description"}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <p className="text-xs text-muted-foreground">{formatDate(sop.updated_at)}</p>
        </CardFooter>
      </Card>
    </Link>
  );
}
