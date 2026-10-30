"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

interface BillingPriceSettingsForm {
  monthlyPriceId: string;
  annualPriceId: string;
  pass7dPriceId: string;
  launchCouponId: string;
  launchEnabled: boolean;
  launchSeatsLimit: number;
  firstPassCouponId: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

function emptyForm(): BillingPriceSettingsForm {
  return {
    monthlyPriceId: "",
    annualPriceId: "",
    pass7dPriceId: "",
    launchCouponId: "",
    launchEnabled: false,
    launchSeatsLimit: 50,
    firstPassCouponId: "",
    updatedAt: null,
    updatedBy: null,
  };
}

export function BillingPricesPanel(): React.ReactElement {
  const router = useRouter();
  const [form, setForm] = useState<BillingPriceSettingsForm>(emptyForm);
  const [launchSeatsUsed, setLaunchSeatsUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const response = await fetch("/api/admin/settings/billing-prices");
        if (!response.ok) {
          setError("Could not load billing price settings");
          return;
        }
        const data = (await response.json()) as {
          settings: {
            monthlyPriceId: string | null;
            annualPriceId: string | null;
            pass7dPriceId: string | null;
            launchCouponId: string | null;
            launchEnabled: boolean;
            launchSeatsLimit: number;
            firstPassCouponId: string | null;
            updatedAt: string | null;
            updatedBy: string | null;
          };
          launchSeatsUsed: number;
        };
        setForm({
          monthlyPriceId: data.settings.monthlyPriceId ?? "",
          annualPriceId: data.settings.annualPriceId ?? "",
          pass7dPriceId: data.settings.pass7dPriceId ?? "",
          launchCouponId: data.settings.launchCouponId ?? "",
          launchEnabled: data.settings.launchEnabled,
          launchSeatsLimit: data.settings.launchSeatsLimit,
          firstPassCouponId: data.settings.firstPassCouponId ?? "",
          updatedAt: data.settings.updatedAt,
          updatedBy: data.settings.updatedBy,
        });
        setLaunchSeatsUsed(data.launchSeatsUsed);
      } catch {
        setError("Could not load billing price settings");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setValidationErrors([]);
    setWarnings([]);
    try {
      const response = await fetch("/api/admin/settings/billing-prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyPriceId: form.monthlyPriceId.trim() || null,
          annualPriceId: form.annualPriceId.trim() || null,
          pass7dPriceId: form.pass7dPriceId.trim() || null,
          launchCouponId: form.launchCouponId.trim() || null,
          launchEnabled: form.launchEnabled,
          launchSeatsLimit: form.launchSeatsLimit,
          firstPassCouponId: form.firstPassCouponId.trim() || null,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        errors?: string[];
        warnings?: string[];
        settings?: {
          updatedAt: string | null;
          updatedBy: string | null;
        };
        launchSeatsUsed?: number;
      };
      if (!response.ok) {
        setError(data.error || "Could not update billing prices");
        setValidationErrors(data.errors ?? []);
        return;
      }
      setWarnings(data.warnings ?? []);
      if (data.settings) {
        setForm((prev) => ({
          ...prev,
          updatedAt: data.settings?.updatedAt ?? null,
          updatedBy: data.settings?.updatedBy ?? null,
        }));
      }
      if (typeof data.launchSeatsUsed === "number") {
        setLaunchSeatsUsed(data.launchSeatsUsed);
      }
      router.refresh();
    } catch {
      setError("Could not update billing prices");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card padding="lg">
        <CardContent>
          <div className="h-40 animate-pulse rounded-lg bg-charcoal-800" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Stripe price & coupon IDs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-charcoal-400">
          Configure live Stripe Price and Coupon IDs without a redeploy. Amounts
          are owned in Stripe — only IDs are stored here.
        </p>
        {form.updatedAt && (
          <p className="text-sm text-charcoal-300">
            Last changed {new Date(form.updatedAt).toLocaleString()}
            {form.updatedBy ? ` by ${form.updatedBy}` : ""}
          </p>
        )}

        <p className="text-sm text-charcoal-300">
          Launch seats used:{" "}
          <span className="font-semibold text-charcoal-100">
            {launchSeatsUsed} / {form.launchSeatsLimit}
          </span>
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-charcoal-300">Monthly price ID</span>
            <input
              className="w-full rounded-md border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-charcoal-100"
              value={form.monthlyPriceId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, monthlyPriceId: e.target.value }))
              }
              placeholder="price_..."
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-charcoal-300">Annual price ID</span>
            <input
              className="w-full rounded-md border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-charcoal-100"
              value={form.annualPriceId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, annualPriceId: e.target.value }))
              }
              placeholder="price_..."
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-charcoal-300">7-day pass price ID</span>
            <input
              className="w-full rounded-md border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-charcoal-100"
              value={form.pass7dPriceId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, pass7dPriceId: e.target.value }))
              }
              placeholder="price_..."
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-charcoal-300">Launch coupon ID</span>
            <input
              className="w-full rounded-md border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-charcoal-100"
              value={form.launchCouponId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, launchCouponId: e.target.value }))
              }
              placeholder="coupon_..."
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-charcoal-300">First-pass coupon ID</span>
            <input
              className="w-full rounded-md border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-charcoal-100"
              value={form.firstPassCouponId}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  firstPassCouponId: e.target.value,
                }))
              }
              placeholder="coupon_..."
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-charcoal-300">Launch seats limit</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-md border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-charcoal-100"
              value={form.launchSeatsLimit}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  launchSeatsLimit: Number(e.target.value) || 0,
                }))
              }
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-charcoal-300">
          <input
            type="checkbox"
            checked={form.launchEnabled}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, launchEnabled: e.target.checked }))
            }
          />
          Launch offer enabled
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {validationErrors.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-400">
            {validationErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-400">
            {warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        <Button variant="gold" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save price settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
