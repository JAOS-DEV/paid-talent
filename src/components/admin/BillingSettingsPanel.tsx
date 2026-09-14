"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ConfirmReasonDialog } from "@/components/admin/ConfirmReasonDialog";

type BillingAccessMode = "enforced" | "open_access";

interface BillingSettingsPanelProps {
  mode: BillingAccessMode;
  reason: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export function BillingSettingsPanel({
  mode,
  reason,
  updatedAt,
  updatedBy,
}: BillingSettingsPanelProps): React.ReactElement {
  const router = useRouter();
  const [nextMode, setNextMode] = useState<BillingAccessMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (reasonText: string): Promise<void> => {
    if (!nextMode) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: nextMode,
          previousMode: mode,
          reason: reasonText,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not update paywall mode");
        return;
      }
      setNextMode(null);
      router.refresh();
    } catch {
      setError("Could not update paywall mode");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Subscription paywall</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-charcoal-300">
          Current mode:{" "}
          <span className="font-semibold text-charcoal-100">
            {mode === "open_access" ? "Open Access" : "Enabled"}
          </span>
        </p>
        {updatedAt && (
          <p className="text-sm text-charcoal-500">
            Last changed {new Date(updatedAt).toLocaleString()}
            {updatedBy ? ` by ${updatedBy}` : ""}
            {reason ? ` · ${reason}` : ""}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-charcoal-700 p-4">
            <h3 className="font-medium text-charcoal-100">Enabled</h3>
            <p className="text-sm text-charcoal-400 mt-2">
              Paid/admin entitlement required for premium features.
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              disabled={mode === "enforced"}
              onClick={() => setNextMode("enforced")}
            >
              Switch to Enabled
            </Button>
          </div>
          <div className="rounded-lg border border-charcoal-700 p-4">
            <h3 className="font-medium text-charcoal-100">Open Access</h3>
            <p className="text-sm text-charcoal-400 mt-2">
              Premium features are temporarily available without subscription.
              Top Talent status/badges still remain visible and continue tracking
              normally.
            </p>
            <Button
              className="mt-4"
              variant="gold"
              disabled={mode === "open_access"}
              onClick={() => setNextMode("open_access")}
            >
              Switch to Open Access
            </Button>
          </div>
        </div>
      </CardContent>

      <ConfirmReasonDialog
        open={nextMode !== null}
        title={
          nextMode === "open_access"
            ? "Turn on Open Access"
            : "Turn paywall enforcement back on"
        }
        description="This is a high-impact platform setting. It does not change Stripe subscriptions, Top Talent ranking, or historical billing records."
        confirmLabel="Save paywall mode"
        destructive={nextMode === "open_access"}
        busy={busy}
        error={error}
        onCancel={() => setNextMode(null)}
        onConfirm={(reasonText) => void submit(reasonText)}
      />
    </Card>
  );
}
