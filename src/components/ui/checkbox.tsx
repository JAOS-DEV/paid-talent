"use client";

import React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className = "", ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border border-charcoal-500 bg-charcoal-800 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-950 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600 ${className}`}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
