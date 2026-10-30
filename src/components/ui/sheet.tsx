"use client";

import React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

export const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(function SheetOverlay({ className = "", ...props }, ref) {
  return (
    <SheetPrimitive.Overlay
      ref={ref}
      className={`fixed inset-0 z-50 bg-black/70 ${className}`}
      {...props}
    />
  );
});

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>
>(function SheetContent({ className = "", children, ...props }, ref) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={`fixed inset-y-0 right-0 z-50 flex h-full w-[min(18rem,calc(100vw-1rem))] flex-col border-l border-charcoal-700 bg-charcoal-900 p-4 shadow-xl ${className}`}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});

export function SheetHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={`mb-4 ${className}`} {...props} />;
}

export function SheetTitle({
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>): React.ReactElement {
  return (
    <SheetPrimitive.Title
      className={`text-lg font-semibold text-charcoal-100 ${className}`}
      {...props}
    />
  );
}
