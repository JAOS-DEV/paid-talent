"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ConfirmReasonDialog } from "@/components/admin/ConfirmReasonDialog";

type AccountStatus = "active" | "suspended" | "banned";

interface UserModerationPanelProps {
  userId: string;
  accountStatus: AccountStatus;
  isSelf: boolean;
}

type DialogKind = "suspend" | "reactivate" | "ban" | "lift_ban" | null;

export function UserModerationPanel({
  userId,
  accountStatus,
  isSelf,
}: UserModerationPanelProps): React.ReactElement {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (action: Exclude<DialogKind, null>, reason: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Action failed");
        return;
      }
      setDialog(null);
      router.refresh();
    } catch {
      setError("Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Account moderation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-charcoal-400 capitalize">
          Current status: {accountStatus}
        </p>
        {isSelf && (
          <p className="text-sm text-gold-500">
            You cannot suspend or ban your own currently authenticated account.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          {accountStatus === "active" && (
            <Button
              type="button"
              variant="secondary"
              disabled={isSelf}
              onClick={() => setDialog("suspend")}
            >
              Suspend account
            </Button>
          )}
          {accountStatus === "suspended" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog("reactivate")}
            >
              Reactivate account
            </Button>
          )}
          {accountStatus !== "banned" && (
            <Button
              type="button"
              disabled={isSelf}
              onClick={() => setDialog("ban")}
            >
              Ban account
            </Button>
          )}
          {accountStatus === "banned" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog("lift_ban")}
            >
              Lift ban
            </Button>
          )}
        </div>
      </CardContent>

      <ConfirmReasonDialog
        open={dialog === "suspend"}
        title="Suspend account"
        description="The account remains recorded but cannot sign in or use Paid Talent until reactivated. Public content is unpublished immediately."
        confirmLabel="Suspend"
        destructive
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={(reason) => void submit("suspend", reason)}
      />
      <ConfirmReasonDialog
        open={dialog === "ban"}
        title="Ban account"
        description="This verified identity cannot sign in or register again. The account is kept for moderation history."
        confirmLabel="Ban"
        destructive
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={(reason) => void submit("ban", reason)}
      />
      <ConfirmReasonDialog
        open={dialog === "reactivate"}
        title="Reactivate account"
        description="Restore this suspended account to active status."
        confirmLabel="Reactivate"
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={(reason) => void submit("reactivate", reason)}
      />
      <ConfirmReasonDialog
        open={dialog === "lift_ban"}
        title="Lift ban"
        description="Allow this verified identity to sign in or register again."
        confirmLabel="Lift ban"
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={(reason) => void submit("lift_ban", reason)}
      />
    </Card>
  );
}
