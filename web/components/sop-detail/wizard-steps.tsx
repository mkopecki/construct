"use client";

import { Check } from "lucide-react";

interface WizardStepsProps {
  current: number;
  steps: string[];
}

export function WizardSteps({ current, steps }: WizardStepsProps) {
  const progress = current === 0 ? 0 : current >= steps.length - 1 ? 100 : (current / (steps.length - 1)) * 100;

  return (
    <div className="relative flex items-center justify-between mb-10">
      {/* Connector line */}
      <div className="wizard-connector">
        <div
          className="wizard-connector-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {steps.map((label, i) => {
        const isComplete = i < current;
        const isActive = i === current;

        return (
          <div key={label} className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={`
                flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300
                ${isComplete
                  ? "border-amber bg-amber text-amber-foreground"
                  : isActive
                    ? "border-amber bg-transparent text-amber glow-border"
                    : "border-white/[0.08] bg-secondary text-muted-foreground"
                }
              `}
            >
              {isComplete ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-sm font-medium">{i + 1}</span>
              )}
            </div>
            <span
              className={`text-[11px] font-medium tracking-wide uppercase whitespace-nowrap transition-colors ${
                isActive ? "text-amber" : isComplete ? "text-foreground/70" : "text-muted-foreground/50"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
