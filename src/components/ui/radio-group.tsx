"use client";

import React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

export const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(function RadioGroup({ className = "", ...props }, ref) {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={className}
      {...props}
    />
  );
});

export const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(function RadioGroupItem({ className = "", ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-charcoal-500 bg-charcoal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-950 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-500 ${className}`}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="h-2.5 w-2.5 rounded-full bg-primary-500" />
    </RadioGroupPrimitive.Item>
  );
});
