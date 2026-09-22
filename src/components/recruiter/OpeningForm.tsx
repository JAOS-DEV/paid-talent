"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Textarea,
  Card,
  CardContent,
} from "@/components/ui";
import { OPENING_NOTES_MAX_LENGTH } from "@/lib/recruiter-profile";
import {
  createOpening,
  updateOpening,
} from "@/lib/recruiter-profile/actions";
import type { RecruiterOpening } from "@/lib/db/schema";
import {
  DEFAULT_OPENING_PAY_CURRENCY,
  DEFAULT_OPENING_PAY_PERIOD,
  emptyPayToNull,
  getOpeningPayAmount,
  hasLegacyPayRange,
  LEGACY_PAY_RANGE_MESSAGE,
  OPENING_PAY_AMOUNT_MAX,
  OPENING_PAY_CURRENCIES,
  OPENING_PAY_PERIOD_OPTIONS,
  OPENING_PAY_PERIOD_PRESETS,
  parseStoredPayPeriod,
  type OpeningPayPeriodPreset,
} from "@/lib/recruiter-profile/opening-pay";

interface OpeningFormProps {
  mode: "create" | "edit";
  initialOpening?: RecruiterOpening | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  THB: "฿",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

const selectClassName =
  "w-full min-w-0 max-w-full min-h-[44px] px-4 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-xl text-charcoal-100 focus:outline-none focus:ring-2 focus:ring-primary-500";

function getInitialPeriod(opening?: RecruiterOpening | null): OpeningPayPeriodPreset {
  const parsed = parseStoredPayPeriod(opening?.payPeriod ?? DEFAULT_OPENING_PAY_PERIOD);
  if (parsed.kind === "preset" && OPENING_PAY_PERIOD_PRESETS.includes(parsed.value)) {
    return parsed.value;
  }
  return DEFAULT_OPENING_PAY_PERIOD;
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
  const [payPeriod, setPayPeriod] = useState<OpeningPayPeriodPreset>(
    () => getInitialPeriod(initialOpening)
  );
  const [notes, setNotes] = useState(initialOpening?.notes || "");
  const [isPublished, setIsPublished] = useState(
    initialOpening?.isPublished ?? false
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (publish: boolean): Promise<void> => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (isLegacyRange && payAmount.trim() === "") {
      setSaving(false);
      setError(LEGACY_PAY_RANGE_MESSAGE);
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

  const notesRemaining = OPENING_NOTES_MAX_LENGTH - notes.length;
  const notesCounterColor =
    notesRemaining <= 20
      ? "text-warning"
      : notesRemaining <= 50
        ? "text-yellow-400"
        : "text-charcoal-400";

  return (
    <form
      className="space-y-6 min-w-0"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(isPublished);
      }}
    >
      <Card padding="lg" className="min-w-0">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-charcoal-100">
              {mode === "create" ? "Add opening" : "Edit opening"}
            </h2>
            <p className="text-sm text-charcoal-400 mt-1">
              Advertise one clear pay amount, then choose the currency and
              period.
            </p>
          </div>

          <CardContent className="space-y-5 !p-0 min-w-0">
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
              <div
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm"
                role="status"
              >
                <p className="text-amber-300">{LEGACY_PAY_RANGE_MESSAGE}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    id="opening-pay"
                    label="Pay amount"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={OPENING_PAY_AMOUNT_MAX}
                    step={1}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="e.g. 1000"
                  />
                </div>
                <div className="w-24">
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
                        {CURRENCY_SYMBOLS[currency] || currency} {currency}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-200 mb-2">
                  Pay period
                </label>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Pay period"
                >
                  {OPENING_PAY_PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPayPeriod(option.value)}
                      className={`px-4 py-2 text-sm rounded-full transition-colors min-h-[44px] ${
                        payPeriod === option.value
                          ? "bg-primary-600 text-white"
                          : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700 border border-charcoal-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Textarea
                label="Notes"
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value.slice(0, OPENING_NOTES_MAX_LENGTH))
                }
                maxLength={OPENING_NOTES_MAX_LENGTH}
                aria-describedby="notes-counter"
                placeholder="Any additional details about this opening"
              />
              <p
                id="notes-counter"
                className={`mt-1.5 text-right text-sm ${notesCounterColor}`}
              >
                {notes.length}/{OPENING_NOTES_MAX_LENGTH}
              </p>
            </div>

            {mode === "edit" && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-charcoal-200">
                  Visibility
                </legend>
                <label className="flex items-center gap-3 text-sm text-charcoal-300 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-5 h-5 rounded border-charcoal-600 bg-charcoal-800 text-primary-600 focus:ring-primary-500 focus:ring-offset-charcoal-900"
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
              <div className="space-y-3">
                <Button
                  type="button"
                  fullWidth
                  loading={saving}
                  onClick={() => void submit(true)}
                >
                  Publish opening
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  loading={saving}
                  onClick={() => void submit(false)}
                >
                  Save as draft
                </Button>
                <p className="text-center text-xs text-charcoal-500">
                  Your opening will be visible to talents after publishing.
                </p>
              </div>
            ) : (
              <Button type="submit" fullWidth loading={saving}>
                Save changes
              </Button>
            )}
          </CardContent>
        </div>
      </Card>
    </form>
  );
}
