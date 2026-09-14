"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import { ConfirmReasonDialog } from "@/components/admin/ConfirmReasonDialog";

interface UserEntitlementPanelProps {
  userId: string;
  entitlement: {
    hasPremiumAccess: boolean;
    sources: string[];
    billingAccessMode: "enforced" | "open_access";
    paidAccess: boolean;
    adminGrantAccess: boolean;
    paidSubscription: {
      status: string;
      plan: string;
      currentPeriodEnd: string | null;
      stripeBacked: boolean;
    } | null;
    adminGrant: {
      isLifetime: boolean;
      expiresAt: string | null;
      reason: string;
    } | null;
  };
}

type GrantDialog =
  | { kind: "days"; days: number }
  | { kind: "lifetime" }
  | { kind: "custom" }
  | { kind: "revoke" }
  | null;

export function UserEntitlementPanel({
  userId,
  entitlement,
}: UserEntitlementPanelProps): React.ReactElement {
  const router = useRouter();
  const [dialog, setDialog] = useState<GrantDialog>(null);
  const [customDays, setCustomDays] = useState("45");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (
    body: Record<string, unknown>,
    reason: string
  ): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/entitlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, reason }),
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

  const sourceLabel =
    entitlement.sources.length > 0
      ? entitlement.sources.join(", ").replaceAll("_", " ")
      : "none";

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Subscription / Premium access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-charcoal-300">
        <div>
          <p className="font-medium text-charcoal-100">Paid subscription</p>
          {entitlement.paidSubscription ? (
            <>
              <p className="capitalize">Status: {entitlement.paidSubscription.status}</p>
              <p>Plan: {entitlement.paidSubscription.plan.replaceAll("_", " ")}</p>
              <p>
                Current period end:{" "}
                {entitlement.paidSubscription.currentPeriodEnd
                  ? new Date(entitlement.paidSubscription.currentPeriodEnd).toLocaleString()
                  : "Unknown"}
              </p>
              <p>
                Source:{" "}
                {entitlement.paidSubscription.stripeBacked
                  ? "Stripe-backed"
                  : "Local subscription record"}
              </p>
            </>
          ) : (
            <p>No paid subscription record.</p>
          )}
        </div>

        <div>
          <p className="font-medium text-charcoal-100">Admin access</p>
          {entitlement.adminGrant && entitlement.adminGrantAccess ? (
            <>
              <p>
                {entitlement.adminGrant.isLifetime
                  ? "Lifetime grant"
                  : `Expires ${
                      entitlement.adminGrant.expiresAt
                        ? new Date(entitlement.adminGrant.expiresAt).toLocaleString()
                        : "unknown"
                    }`}
              </p>
              <p>Reason: {entitlement.adminGrant.reason}</p>
            </>
          ) : (
            <p>No active admin grant.</p>
          )}
        </div>

        <div>
          <p className="font-medium text-charcoal-100">Effective premium access</p>
          <p>{entitlement.hasPremiumAccess ? "Yes" : "No"}</p>
          <p>Source: {sourceLabel}</p>
          <p>
            Paywall mode:{" "}
            {entitlement.billingAccessMode === "open_access"
              ? "Open Access"
              : "Enabled"}
          </p>
        </div>

        <div className="flex flex-col sm:flex-wrap sm:flex-row gap-2">
          {[7, 14, 30, 90].map((days) => (
            <Button
              key={days}
              type="button"
              variant="secondary"
              onClick={() => setDialog({ kind: "days", days })}
            >
              Grant {days} days
            </Button>
          ))}
          <Button type="button" variant="outline" onClick={() => setDialog({ kind: "custom" })}>
            Custom days
          </Button>
          <Button type="button" variant="gold" onClick={() => setDialog({ kind: "lifetime" })}>
            Grant lifetime premium
          </Button>
          {entitlement.adminGrantAccess && (
            <Button type="button" onClick={() => setDialog({ kind: "revoke" })}>
              Revoke admin-granted premium
            </Button>
          )}
        </div>
        <p className="text-charcoal-500">
          Paid Stripe cancellation and refunds are not available in this panel.
          Revoking an admin grant does not change Stripe-owned subscription records.
        </p>
      </CardContent>

      <ConfirmReasonDialog
        open={dialog !== null}
        title={
          dialog?.kind === "revoke"
            ? "Revoke admin-granted premium"
            : dialog?.kind === "lifetime"
              ? "Grant lifetime premium"
              : "Grant admin premium"
        }
        description={
          dialog?.kind === "revoke"
            ? "This only revokes the admin entitlement. Paid Stripe access is left untouched."
            : "This grant is stored separately from Stripe subscriptions."
        }
        confirmLabel={dialog?.kind === "revoke" ? "Revoke" : "Grant"}
        destructive={dialog?.kind === "revoke"}
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={(reason) => {
          if (dialog?.kind === "revoke") {
            void submit({ action: "revoke" }, reason);
            return;
          }
          if (dialog?.kind === "lifetime") {
            void submit({ action: "grant", grantKind: "lifetime" }, reason);
            return;
          }
          if (dialog?.kind === "days") {
            void submit(
              { action: "grant", grantKind: "days", days: dialog.days },
              reason
            );
            return;
          }
          const days = Number.parseInt(customDays, 10);
          void submit({ action: "grant", grantKind: "days", days }, reason);
        }}
      >
        {dialog?.kind === "custom" ? (
          <Input
            label="Number of days"
            type="number"
            min={1}
            max={3650}
            value={customDays}
            onChange={(event) => setCustomDays(event.target.value)}
          />
        ) : null}
      </ConfirmReasonDialog>
    </Card>
  );
}
