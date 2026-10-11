import React from "react";

export interface MarketingStep {
  title: string;
  body: string;
}

interface StepListProps {
  steps: MarketingStep[];
  accent?: "primary" | "gold";
}

export function StepList({
  steps,
  accent = "primary",
}: StepListProps): React.ReactElement {
  const accentClass =
    accent === "gold"
      ? "bg-gold-500/20 text-gold-400"
      : "bg-primary-600/20 text-primary-400";

  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="flex gap-4 rounded-xl border border-charcoal-700 bg-charcoal-900/60 p-4 sm:p-5"
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${accentClass}`}
          >
            {index + 1}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-charcoal-100 sm:text-lg">
              {step.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-charcoal-400">
              {step.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
