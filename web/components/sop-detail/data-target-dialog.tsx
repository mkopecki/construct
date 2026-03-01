"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DataTarget, DataTargetType } from "@/lib/types";

const OPTIONS: {
  type: DataTargetType;
  label: string;
  description: string;
  enabled: boolean;
}[] = [
  {
    type: "discord_webhook",
    label: "Discord Webhook",
    description: "Send a notification to a Discord channel when a run finishes",
    enabled: true,
  },
  {
    type: "slack",
    label: "Slack",
    description: "Post run results to a Slack channel",
    enabled: false,
  },
  {
    type: "email",
    label: "Email",
    description: "Send run results via email",
    enabled: false,
  },
  {
    type: "http_webhook",
    label: "HTTP Webhook",
    description: "POST run results to a custom URL",
    enabled: false,
  },
];

interface DataTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: DataTarget) => void;
  onSkip: () => void;
}

export function DataTargetDialog({
  open,
  onOpenChange,
  onConfirm,
  onSkip,
}: DataTargetDialogProps) {
  const [selected, setSelected] = useState<DataTargetType | null>("discord_webhook");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add a Data Target</DialogTitle>
          <DialogDescription>
            Get notified when workflow runs complete. Select a destination for
            run results.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              disabled={!opt.enabled}
              onClick={() => opt.enabled && setSelected(opt.type)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                !opt.enabled
                  ? "cursor-not-allowed opacity-50"
                  : selected === opt.type
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      selected === opt.type && opt.enabled
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    }`}
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
                {!opt.enabled && (
                  <Badge variant="secondary" className="text-[10px]">
                    Coming soon
                  </Badge>
                )}
              </div>
              <p className="mt-1 ml-5 text-xs text-muted-foreground">
                {opt.description}
              </p>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
          <Button
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onConfirm({ type: selected, enabled: true });
              }
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
