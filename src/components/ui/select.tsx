"use client";

import React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function SelectTrigger({ className = "", children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-charcoal-600 bg-charcoal-800 px-4 py-2.5 text-left text-sm text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon aria-hidden className="text-charcoal-300">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className = "", children, ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position="popper"
        sideOffset={4}
        className={`z-[60] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-charcoal-600 bg-charcoal-900 text-charcoal-100 shadow-xl ${className}`}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className = "", children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={`relative flex min-h-11 cursor-pointer items-center rounded-md px-3 py-2 text-sm text-charcoal-100 outline-none data-[highlighted]:bg-charcoal-700 data-[state=checked]:text-primary-300 ${className}`}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
