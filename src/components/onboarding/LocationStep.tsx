"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@/components/ui";
import { updateProfileLocation } from "@/app/worker/actions";
import { AvailabilityPicker } from "@/components/profile/AvailabilityPicker";
import {
  AREA_MAX_LENGTH,
  DEFAULT_WORKER_PAY_CURRENCY,
  LOCATION_MAX_LENGTH,
  workerPayCurrencyOptions,
} from "@/lib/profile/limits";
import { normalizeAvailability } from "@/lib/profile/availability";
import {
  DEFAULT_WORKER_EXPECTED_PAY_PERIOD,
  WORKER_EXPECTED_PAY_AMOUNT_MAX,
  WORKER_EXPECTED_PAY_PERIOD_OPTIONS,
  type WorkerExpectedPayPeriod,
  parseWorkerExpectedPayPeriod,
} from "@/lib/profile/expected-pay";

interface LocationStepProps {
  initialLocation: string | null;
  initialArea: string | null;
  initialAvailability: string[] | null;
  initialPayAmount: number | null;
  initialPayPeriod: string | null;
  initialPayCurrency: string | null;
  onComplete: () => void;
  onBack: () => void;
}

export function LocationStep({
  initialLocation,
  initialArea,
  initialAvailability,
  initialPayAmount,
  initialPayPeriod,
  initialPayCurrency,
  onComplete,
  onBack,
}: LocationStepProps): React.ReactElement {
  const profile = useTranslations("worker.profile");
  const onboarding = useTranslations("worker.onboarding");
  const common = useTranslations("common");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [area, setArea] = useState(initialArea ?? "");
  const [availability, setAvailability] = useState<string[]>(
    normalizeAvailability(initialAvailability)
  );
  const [payAmount, setPayAmount] = useState(
    initialPayAmount?.toString() ?? ""
  );
  const [payPeriod, setPayPeriod] = useState<WorkerExpectedPayPeriod>(
    parseWorkerExpectedPayPeriod(initialPayPeriod) ??
      DEFAULT_WORKER_EXPECTED_PAY_PERIOD
  );
  const [currency, setCurrency] = useState(
    initialPayCurrency || DEFAULT_WORKER_PAY_CURRENCY
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (!location.trim()) {
      setError(onboarding("locationRequired"));
      return;
    }

    if (availability.length === 0) {
      setError(onboarding("availabilityRequired"));
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const amount = payAmount.trim()
        ? parseInt(payAmount, 10)
        : undefined;
      const result = await updateProfileLocation({
        location: location.trim(),
        area: area.trim() || undefined,
        availability,
        expectedPayAmount: amount,
        expectedPayPeriod: amount != null ? payPeriod : undefined,
        payCurrency: currency,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : profile("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input
          label={profile("location")}
          placeholder={profile("locationPlaceholder")}
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setError(null);
          }}
          maxLength={LOCATION_MAX_LENGTH}
          autoFocus
        />

        <Input
          label={onboarding("areaOptional")}
          placeholder={onboarding("areaExample")}
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setError(null);
          }}
          maxLength={AREA_MAX_LENGTH}
          helperText={onboarding("areaHelp")}
        />

        <AvailabilityPicker
          value={availability}
          onChange={(next) => {
            setAvailability(next);
            setError(null);
          }}
        />

        <div>
          <label className="block text-sm font-medium text-charcoal-200 mb-1.5">
            {onboarding("expectedPayOptional")}
          </label>
          <div className="flex gap-2 items-center">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-3 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {workerPayCurrencyOptions(currency).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={WORKER_EXPECTED_PAY_AMOUNT_MAX}
              step={1}
              placeholder={profile("payAmount")}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="flex-1"
            />
            <select
              value={payPeriod}
              onChange={(e) =>
                setPayPeriod(e.target.value as WorkerExpectedPayPeriod)
              }
              aria-label={profile("payPeriod")}
              className="px-3 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {WORKER_EXPECTED_PAY_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === "day"
                    ? profile("perDay")
                    : profile("perMonth")}
                </option>
              ))}
            </select>
          </div>
          <p className="text-charcoal-300 text-xs mt-1.5">
            {onboarding("payHint")}
          </p>
        </div>

        {error && <p className="text-error text-sm">{error}</p>}
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          {common("back")}
        </Button>
        <Button
          type="submit"
          loading={saving}
          disabled={!location.trim() || availability.length === 0}
          className="flex-1"
        >
          {common("continue")}
        </Button>
      </div>
    </form>
  );
}
