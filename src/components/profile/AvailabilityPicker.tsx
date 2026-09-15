"use client";

import React from "react";
import { AVAILABILITY_OPTIONS } from "@/lib/profile/availability";

interface AvailabilityPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  error?: string | null;
}

export function AvailabilityPicker({
  value,
  onChange,
  error,
}: AvailabilityPickerProps): React.ReactElement {
  function toggleOption(option: string): void {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
      return;
    }
    onChange([...value, option]);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
        Availability
      </label>
      <p className="text-charcoal-400 text-xs mb-2">
        Select every option that applies. You can choose more than one.
      </p>
      <div className="flex flex-wrap gap-2">
        {AVAILABILITY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggleOption(option)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px]
              ${
                value.includes(option)
                  ? "bg-primary-600 text-white"
                  : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
              }
            `}
          >
            {option}
          </button>
        ))}
      </div>
      {error ? <p className="text-error text-sm mt-3">{error}</p> : null}
    </div>
  );
}
