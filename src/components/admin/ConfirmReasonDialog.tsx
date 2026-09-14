"use client";

import React, { useState } from "react";
import { Button, Textarea } from "@/components/ui";

interface ConfirmReasonDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  open: boolean;
  busy?: boolean;
  error?: string | null;
  destructive?: boolean;
  children?: React.ReactNode;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function ConfirmReasonDialog({
  title,
  description,
  confirmLabel,
  open,
  busy = false,
  error = null,
  destructive = false,
  children,
  onCancel,
  onConfirm,
}: ConfirmReasonDialogProps): React.ReactElement | null {
  const [reason, setReason] = useState("");

  if (!open) {
    return null;
  }

  const handleConfirm = (): void => {
    onConfirm(reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-reason-title"
    >
      <div className="w-full max-w-md rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
        <h2
          id="confirm-reason-title"
          className="text-lg font-semibold text-charcoal-100"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-charcoal-400">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-4">
          <Textarea
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={3}
          />
        </div>
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            variant={destructive ? "primary" : "gold"}
            fullWidth
            loading={busy}
            disabled={reason.trim().length < 3 || busy}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
