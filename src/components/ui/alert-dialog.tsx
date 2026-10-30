"use client";

import React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;

export const AlertDialogOverlay = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(function AlertDialogOverlay({ className = "", ...props }, ref) {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      className={`fixed inset-0 z-50 bg-black/70 ${className}`}
      {...props}
    />
  );
});

export const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(function AlertDialogContent({ className = "", ...props }, ref) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={`fixed left-1/2 top-1/2 z-50 w-[min(calc(100%-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-charcoal-700 bg-charcoal-900 p-5 shadow-xl ${className}`}
        {...props}
      />
    </AlertDialogPortal>
  );
});

export function AlertDialogHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={`space-y-2 ${className}`} {...props} />;
}

export function AlertDialogFooter({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={`mt-5 flex flex-col gap-2 ${className}`} {...props} />
  );
}

export const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(function AlertDialogTitle({ className = "", ...props }, ref) {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      className={`text-lg font-semibold text-charcoal-100 ${className}`}
      {...props}
    />
  );
});

export const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(function AlertDialogDescription({ className = "", ...props }, ref) {
  return (
    <AlertDialogPrimitive.Description
      ref={ref}
      className={`text-sm text-charcoal-400 ${className}`}
      {...props}
    />
  );
});

export const AlertDialogCancel = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(function AlertDialogCancel({ className = "", ...props }, ref) {
  return (
    <AlertDialogPrimitive.Cancel
      ref={ref}
      className={`inline-flex h-11 w-full items-center justify-center rounded-lg border border-charcoal-600 bg-charcoal-700 px-4 text-sm font-medium text-charcoal-100 hover:bg-charcoal-600 ${className}`}
      {...props}
    />
  );
});
