"use client";

import React from "react";
import { ONBOARDING_STEPS } from "@/lib/profile";

interface OnboardingStepperProps {
  currentStepId: string;
  completedSteps: string[];
}

export function OnboardingStepper({
  currentStepId,
  completedSteps,
}: OnboardingStepperProps): React.ReactElement {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStepId);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-charcoal-400">
          Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
        </span>
        <span className="text-sm text-charcoal-400">
          {Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100)}%
        </span>
      </div>

      <div className="flex gap-1">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStepId;
          const isPast = index < currentIndex;

          return (
            <div
              key={step.id}
              className={`
                h-1.5 flex-1 rounded-full transition-colors
                ${isCompleted || isPast ? "bg-primary-500" : ""}
                ${isCurrent && !isCompleted ? "bg-primary-400" : ""}
                ${!isCompleted && !isCurrent && !isPast ? "bg-charcoal-700" : ""}
              `}
            />
          );
        })}
      </div>

      <div className="mt-4">
        <h2 className="text-xl font-semibold text-charcoal-100">
          {ONBOARDING_STEPS[currentIndex]?.title}
        </h2>
        <p className="text-sm text-charcoal-400 mt-1">
          {ONBOARDING_STEPS[currentIndex]?.description}
        </p>
      </div>
    </div>
  );
}
