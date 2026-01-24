"use client";

import clsx from "clsx";

interface Step {
  label: string;
  description?: string;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number; // 0-indexed, -1 = idle
  className?: string;
}

export function StepProgress({ steps, currentStep, className }: StepProgressProps) {
  return (
    <div className={clsx("flex items-center gap-1", className)} role="progressbar" aria-valuenow={currentStep + 1} aria-valuemax={steps.length}>
      {steps.map((step, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        const isPending = i > currentStep;
        return (
          <div key={i} className="flex items-center gap-1">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300",
                  isComplete && "bg-[var(--color-brand)] text-white",
                  isCurrent && "bg-[var(--color-brand-dim)] text-[var(--color-brand)] ring-2 ring-[var(--color-brand)]",
                  isPending && "bg-[var(--color-surface)] text-[var(--color-muted)]"
                )}
              >
                {isComplete ? "✓" : i + 1}
              </div>
              <span className={clsx(
                "text-[9px] mt-1 whitespace-nowrap",
                isCurrent ? "text-white" : "text-[var(--color-muted)]"
              )}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={clsx(
                  "w-6 h-0.5 rounded-full mt-[-12px] transition-all duration-300",
                  isComplete ? "bg-[var(--color-brand)]" : "bg-[var(--color-border)]"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
