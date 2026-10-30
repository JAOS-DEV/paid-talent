"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BlockAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
}

export function BlockAlertDialog({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: BlockAlertDialogProps): React.ReactElement {
  const t = useTranslations("safety.blocks");
  const common = useTranslations("common");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("block")}</AlertDialogTitle>
          <AlertDialogDescription>{t("confirm")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{common("cancel")}</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            fullWidth
            disabled={busy}
            onClick={onConfirm}
          >
            {t("block")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
