"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: Set<number>;
  failedStep?: number;
}

export function StepProgress({
  currentStep,
  totalSteps,
  completedSteps,
  failedStep,
}: StepProgressProps) {
  if (totalSteps === 0) return null;

  return (
    <div className="space-y-1">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = completedSteps.has(step);
        const isFailed = failedStep === step;
        const isRunning = step === currentStep && !isCompleted && !isFailed;

        return (
          <div key={step} className="flex items-center gap-2 text-sm">
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : isFailed ? (
              <XCircle className="h-4 w-4 text-red-600" />
            ) : isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={
                isCompleted
                  ? "text-green-700"
                  : isFailed
                    ? "text-red-700"
                    : isRunning
                      ? "text-blue-700 font-medium"
                      : "text-muted-foreground"
              }
            >
              Step {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}
