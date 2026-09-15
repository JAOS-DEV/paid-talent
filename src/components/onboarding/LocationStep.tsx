"use client";

import React, { useState } from "react";
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

interface LocationStepProps {
  initialLocation: string | null;
  initialArea: string | null;
  initialAvailability: string[] | null;
  initialPayMin: number | null;
  initialPayMax: number | null;
  initialPayCurrency: string | null;
  onComplete: () => void;
  onBack: () => void;
}

export function LocationStep({
  initialLocation,
  initialArea,
  initialAvailability,
  initialPayMin,
  initialPayMax,
  initialPayCurrency,
  onComplete,
  onBack,
}: LocationStepProps): React.ReactElement {
  const [location, setLocation] = useState(initialLocation ?? "");
  const [area, setArea] = useState(initialArea ?? "");
  const [availability, setAvailability] = useState<string[]>(
    normalizeAvailability(initialAvailability)
  );
  const [payMin, setPayMin] = useState(initialPayMin?.toString() ?? "");
  const [payMax, setPayMax] = useState(initialPayMax?.toString() ?? "");
  const [currency, setCurrency] = useState(
    initialPayCurrency || DEFAULT_WORKER_PAY_CURRENCY
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (!location.trim()) {
      setError("Location is required");
      return;
    }

    if (availability.length === 0) {
      setError("Availability is required");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const result = await updateProfileLocation({
        location: location.trim(),
        area: area.trim() || undefined,
        availability,
        expectedPayMin: payMin ? parseInt(payMin, 10) : undefined,
        expectedPayMax: payMax ? parseInt(payMax, 10) : undefined,
        payCurrency: currency,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input
          label="Location"
          placeholder="City, Country"
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setError(null);
          }}
          maxLength={LOCATION_MAX_LENGTH}
          autoFocus
        />

        <Input
          label="Area (optional)"
          placeholder="e.g., Downtown, Suburbs"
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setError(null);
          }}
          maxLength={AREA_MAX_LENGTH}
          helperText="Specific area or neighborhood"
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
            Expected Pay (optional)
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
              placeholder="Min"
              value={payMin}
              onChange={(e) => setPayMin(e.target.value)}
              className="flex-1"
            />
            <span className="text-charcoal-500">-</span>
            <Input
              type="number"
              placeholder="Max"
              value={payMax}
              onChange={(e) => setPayMax(e.target.value)}
              className="flex-1"
            />
          </div>
          <p className="text-charcoal-500 text-xs mt-1.5">
            Per hour, day, or as you prefer
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
          Back
        </Button>
        <Button
          type="submit"
          loading={saving}
          disabled={!location.trim() || availability.length === 0}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
