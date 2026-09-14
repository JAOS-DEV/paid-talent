"use client";

import React from "react";
import { ONBOARDING_STEPS } from "@/lib/profile";

interface OnboardingStepperProps {
  currentStepId: string;
}

export function OnboardingStepper({
  currentStepId,
}: OnboardingStepperProps): React.ReactElement {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStepId);
  const currentPosition = currentIndex + 1;
  const totalSteps = ONBOARDING_STEPS.length;
  const percentComplete = Math.round((currentPosition / totalSteps) * 100);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-charcoal-400">
          Step {currentPosition} of {totalSteps}
        </span>
        <span className="text-sm text-charcoal-400">{percentComplete}%</span>
      </div>

      <div className="flex gap-1">
        {ONBOARDING_STEPS.map((step, index) => {
          const isFilled = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div
              key={step.id}
              data-testid="onboarding-progress-segment"
              data-filled={isFilled ? "true" : "false"}
              className={`
                h-1.5 flex-1 rounded-full transition-colors
                ${isFilled && !isCurrent ? "bg-primary-500" : ""}
                ${isCurrent ? "bg-primary-400" : ""}
                ${!isFilled ? "bg-charcoal-700" : ""}
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
