"use client";

import React, { useState } from "react";
import { Button, Textarea } from "@/components/ui";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AdminReasonAlertDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  destructive?: boolean;
  minLength?: number;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function AdminReasonAlertDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  error = null,
  destructive = false,
  minLength = 5,
  onCancel,
  onConfirm,
}: AdminReasonAlertDialogProps): React.ReactElement {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const canConfirm = trimmed.length >= minLength && !busy;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) {
          setReason("");
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-4">
          <Textarea
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={minLength}
          />
          <p className="mt-1 text-xs text-charcoal-500">
            At least {minLength} characters. This is stored on the audit row.
          </p>
        </div>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        <AlertDialogFooter>
          <Button
            type="button"
            variant={destructive ? "destructive" : "gold"}
            fullWidth
            loading={busy}
            disabled={!canConfirm}
            onClick={() => onConfirm(trimmed)}
          >
            {confirmLabel}
          </Button>
          <AlertDialogCancel disabled={busy} onClick={() => setReason("")}>
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
