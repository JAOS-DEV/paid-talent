"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { OPENING_NOTES_MAX_LENGTH } from "@/lib/recruiter-profile";
import {
  createOpening,
  updateOpening,
} from "@/lib/recruiter-profile/actions";
import type { RecruiterOpening } from "@/lib/db/schema";
import {
  CUSTOM_PAY_PERIOD_UNITS,
  DEFAULT_OPENING_PAY_CURRENCY,
  DEFAULT_OPENING_PAY_PERIOD,
  emptyPayToNull,
  getOpeningPayAmount,
  hasLegacyPayRange,
  LEGACY_PAY_RANGE_MESSAGE,
  OPENING_PAY_AMOUNT_MAX,
  OPENING_PAY_CURRENCIES,
  OPENING_PAY_PERIOD_OPTIONS,
  parseStoredPayPeriod,
  serializeCustomPayPeriod,
  type CustomPayPeriodUnit,
  type OpeningPayPeriodPreset,
} from "@/lib/recruiter-profile/opening-pay";

interface OpeningFormProps {
  mode: "create" | "edit";
  initialOpening?: RecruiterOpening | null;
}

const selectClassName =
  "w-full min-w-0 max-w-full min-h-11 px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500";

function initialPeriodState(opening?: RecruiterOpening | null): {
  periodKind: OpeningPayPeriodPreset | "custom";
  customDuration: string;
  customUnit: CustomPayPeriodUnit;
} {
  const parsed = parseStoredPayPeriod(
    opening?.payPeriod ?? DEFAULT_OPENING_PAY_PERIOD
  );
  if (parsed.kind === "custom") {
    return {
      periodKind: "custom",
      customDuration: String(parsed.duration),
      customUnit: parsed.unit,
    };
  }
  return {
    periodKind: parsed.kind === "preset" ? parsed.value : DEFAULT_OPENING_PAY_PERIOD,
    customDuration: "",
    customUnit: "days",
  };
}

export function OpeningForm({
  mode,
  initialOpening = null,
}: OpeningFormProps): React.ReactElement {
  const router = useRouter();
  const isLegacyRange = Boolean(
    initialOpening && hasLegacyPayRange(initialOpening)
  );
  const initialAmount = initialOpening
    ? getOpeningPayAmount(initialOpening)
    : null;
  const initialPeriod = initialPeriodState(initialOpening);

  const [role, setRole] = useState(initialOpening?.role || "");
  const [area, setArea] = useState(initialOpening?.area || "");
  const [payAmount, setPayAmount] = useState(
    initialAmount != null ? String(initialAmount) : ""
  );
  const [payCurrency, setPayCurrency] = useState(() => {
    const stored = initialOpening?.payCurrency?.trim().toUpperCase();
    if (
      stored &&
      (OPENING_PAY_CURRENCIES as readonly string[]).includes(stored)
    ) {
      return stored;
    }
    return DEFAULT_OPENING_PAY_CURRENCY;
  });
  const [periodKind, setPeriodKind] = useState<OpeningPayPeriodPreset | "custom">(
    initialPeriod.periodKind
  );
  const [customDuration, setCustomDuration] = useState(
    initialPeriod.customDuration
  );
  const [customUnit, setCustomUnit] = useState<CustomPayPeriodUnit>(
    initialPeriod.customUnit
  );
  const [notes, setNotes] = useState(initialOpening?.notes || "");
  const [isPublished, setIsPublished] = useState(
    initialOpening?.isPublished ?? false
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resolvePayPeriod = (): string | null => {
    if (periodKind !== "custom") {
      return periodKind;
    }
    const duration = Number(customDuration.trim());
    if (!Number.isInteger(duration) || duration < 1) {
      return null;
    }
    return serializeCustomPayPeriod(duration, customUnit);
  };

  const submit = async (publish: boolean): Promise<void> => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (isLegacyRange && payAmount.trim() === "") {
      setSaving(false);
      setError(LEGACY_PAY_RANGE_MESSAGE);
      return;
    }

    const payPeriod = resolvePayPeriod();
    if (!payPeriod) {
      setSaving(false);
      setError("Enter a custom period duration of at least 1.");
      return;
    }

    const payload = {
      role,
      area,
      payAmount: emptyPayToNull(payAmount),
      payCurrency,
      payPeriod,
      notes: notes.trim() === "" ? undefined : notes,
      isPublished: publish,
    };

    const result =
      mode === "create"
        ? await createOpening(payload)
        : await updateOpening({
            id: initialOpening!.id,
            ...payload,
          });

    setSaving(false);

    if (!result.success) {
      setError(result.error || "Failed to save opening");
      return;
    }

    if (mode === "create") {
      router.push("/recruiter/openings");
      router.refresh();
      return;
    }

    setIsPublished(publish);
    setSuccess("Opening saved");
    router.refresh();
  };

  return (
    <form
      className="space-y-6 min-w-0"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(isPublished);
      }}
    >
      <Card padding="lg" className="min-w-0">
        <CardHeader>
          <CardTitle>
            {mode === "create" ? "Add opening" : "Edit opening"}
          </CardTitle>
          <p className="text-sm text-charcoal-400 mt-1">
            Advertise one clear pay amount, then choose the currency and the
            period it covers.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 min-w-0">
          <Input
            id="opening-role"
            label="Role *"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={100}
            required
            placeholder="e.g. Bartender"
          />

          <Input
            id="opening-area"
            label="Area *"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            maxLength={100}
            required
            placeholder="e.g. Sukhumvit"
          />

          {isLegacyRange && (
            <p
              className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3"
              role="status"
            >
              {LEGACY_PAY_RANGE_MESSAGE}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
            <div className="sm:col-span-2 min-w-0">
              <Input
                id="opening-pay"
                label="Pay"
                type="number"
                inputMode="numeric"
                min={0}
                max={OPENING_PAY_AMOUNT_MAX}
                step={1}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="opening-pay-currency"
                className="block text-sm font-medium text-charcoal-200 mb-1.5"
              >
                Currency
              </label>
              <select
                id="opening-pay-currency"
                value={payCurrency}
                onChange={(e) => setPayCurrency(e.target.value)}
                className={selectClassName}
              >
                {OPENING_PAY_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="opening-pay-period"
                className="block text-sm font-medium text-charcoal-200 mb-1.5"
              >
                Pay period
              </label>
              <select
                id="opening-pay-period"
                value={periodKind}
                onChange={(e) =>
                  setPeriodKind(e.target.value as OpeningPayPeriodPreset | "custom")
                }
                className={selectClassName}
              >
                {OPENING_PAY_PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {periodKind === "custom" && (
            <div className="grid grid-cols-2 gap-3 min-w-0">
              <Input
                id="opening-custom-duration"
                label="Duration"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                placeholder="15"
              />
              <div className="min-w-0">
                <label
                  htmlFor="opening-custom-unit"
                  className="block text-sm font-medium text-charcoal-200 mb-1.5"
                >
                  Unit
                </label>
                <select
                  id="opening-custom-unit"
                  value={customUnit}
                  onChange={(e) =>
                    setCustomUnit(e.target.value as CustomPayPeriodUnit)
                  }
                  className={selectClassName}
                >
                  {CUSTOM_PAY_PERIOD_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value.slice(0, OPENING_NOTES_MAX_LENGTH))
              }
              maxLength={OPENING_NOTES_MAX_LENGTH}
              aria-describedby="notes-counter"
            />
            <p
              id="notes-counter"
              className="mt-1 text-right text-xs text-charcoal-500"
            >
              {notes.length}/{OPENING_NOTES_MAX_LENGTH}
            </p>
          </div>

          {mode === "edit" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-charcoal-200">
                Visibility
              </legend>
              <label className="flex items-center gap-2 text-sm text-charcoal-300">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded border-charcoal-600"
                />
                Published (visible to workers)
              </label>
            </fieldset>
          )}

          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-400" role="status">
              {success}
            </p>
          )}

          {mode === "create" ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                fullWidth
                loading={saving}
                onClick={() => void submit(false)}
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                fullWidth
                loading={saving}
                onClick={() => void submit(true)}
              >
                Publish
              </Button>
            </div>
          ) : (
            <Button type="submit" fullWidth loading={saving}>
              Save changes
            </Button>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
