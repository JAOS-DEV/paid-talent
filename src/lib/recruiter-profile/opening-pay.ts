export const OPENING_PAY_CURRENCIES = [
  "THB",
  "USD",
  "EUR",
  "GBP",
  "JPY",
] as const;

export type OpeningPayCurrency = (typeof OPENING_PAY_CURRENCIES)[number];

export const DEFAULT_OPENING_PAY_CURRENCY: OpeningPayCurrency = "THB";

export const OPENING_PAY_PERIOD_PRESETS = [
  "night",
  "day",
  "week",
  "month",
  "engagement",
] as const;

export type OpeningPayPeriodPreset =
  (typeof OPENING_PAY_PERIOD_PRESETS)[number];

export const DEFAULT_OPENING_PAY_PERIOD: OpeningPayPeriodPreset = "night";

export const CUSTOM_PAY_PERIOD_UNITS = ["days", "weeks", "months"] as const;

export type CustomPayPeriodUnit = (typeof CUSTOM_PAY_PERIOD_UNITS)[number];

export const CUSTOM_PAY_PERIOD_MAX: Record<CustomPayPeriodUnit, number> = {
  days: 365,
  weeks: 52,
  months: 24,
};

export const OPENING_PAY_AMOUNT_MAX = 10_000_000;

export const LEGACY_PAY_RANGE_MESSAGE =
  "This opening uses the older pay-range format. Enter a single advertised pay amount before saving.";

export const OPENING_PAY_PERIOD_OPTIONS = [
  { value: "night", label: "Per night" },
  { value: "day", label: "Per day" },
  { value: "week", label: "Per week" },
  { value: "month", label: "Per month" },
  { value: "engagement", label: "For the whole engagement" },
  { value: "custom", label: "Custom period" },
] as const;

export interface OpeningPayFields {
  payMin?: number | null;
  payMax?: number | null;
  payCurrency?: string | null;
  payPeriod?: string | null;
}

const CUSTOM_UNIT_ALIASES: Record<string, CustomPayPeriodUnit> = {
  day: "days",
  days: "days",
  week: "weeks",
  weeks: "weeks",
  month: "months",
  months: "months",
};

function isPayPeriodPreset(value: string): value is OpeningPayPeriodPreset {
  return (OPENING_PAY_PERIOD_PRESETS as readonly string[]).includes(value);
}

function singularUnitLabel(unit: CustomPayPeriodUnit): string {
  if (unit === "days") return "day";
  if (unit === "weeks") return "week";
  return "month";
}

export function hasLegacyPayRange(opening: OpeningPayFields): boolean {
  return (
    opening.payMin != null &&
    opening.payMax != null &&
    opening.payMin !== opening.payMax
  );
}

export function getOpeningPayAmount(opening: OpeningPayFields): number | null {
  if (hasLegacyPayRange(opening)) {
    return null;
  }
  if (opening.payMin != null) {
    return opening.payMin;
  }
  if (opening.payMax != null) {
    return opening.payMax;
  }
  return null;
}

export function toOpeningPayStorage(payAmount: number | null): {
  payMin: number | null;
  payMax: null;
} {
  return {
    payMin: payAmount,
    payMax: null,
  };
}

export function serializeCustomPayPeriod(
  duration: number,
  unit: CustomPayPeriodUnit
): string {
  const label = duration === 1 ? singularUnitLabel(unit) : unit;
  return `${duration} ${label}`;
}

export function canonicalizePayPeriod(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    return DEFAULT_OPENING_PAY_PERIOD;
  }
  if (isPayPeriodPreset(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d+)\s+(day|days|week|weeks|month|months)$/);
  if (!match) {
    return null;
  }

  const duration = Number(match[1]);
  const unit = CUSTOM_UNIT_ALIASES[match[2]];
  if (!Number.isInteger(duration) || duration < 1 || !unit) {
    return null;
  }
  if (duration > CUSTOM_PAY_PERIOD_MAX[unit]) {
    return null;
  }

  return serializeCustomPayPeriod(duration, unit);
}

export function parseStoredPayPeriod(value: string | null | undefined):
  | { kind: "preset"; value: OpeningPayPeriodPreset }
  | { kind: "custom"; duration: number; unit: CustomPayPeriodUnit }
  | { kind: "invalid" } {
  if (value == null || value.trim() === "") {
    return { kind: "preset", value: DEFAULT_OPENING_PAY_PERIOD };
  }

  const canonical = canonicalizePayPeriod(value);
  if (!canonical) {
    return { kind: "invalid" };
  }

  if (isPayPeriodPreset(canonical)) {
    return { kind: "preset", value: canonical };
  }

  const match = canonical.match(/^(\d+)\s+(day|days|week|weeks|month|months)$/);
  if (!match) {
    return { kind: "invalid" };
  }

  return {
    kind: "custom",
    duration: Number(match[1]),
    unit: CUSTOM_UNIT_ALIASES[match[2]],
  };
}

export function emptyPayToNull(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function formatPayNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function resolveDisplayCurrency(value: string | null | undefined): string {
  if (!value) {
    return DEFAULT_OPENING_PAY_CURRENCY;
  }
  const normalized = value.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }
  return DEFAULT_OPENING_PAY_CURRENCY;
}

function formatPeriodPhrase(period: string | null | undefined): string | null {
  const parsed = parseStoredPayPeriod(period);
  if (parsed.kind === "preset") {
    if (parsed.value === "engagement") {
      return "for engagement";
    }
    return `/ ${parsed.value}`;
  }
  if (parsed.kind === "custom") {
    return `/ ${serializeCustomPayPeriod(parsed.duration, parsed.unit)}`;
  }
  return null;
}

function formatAmountWithCurrencyAndPeriod(
  amountLabel: string,
  currency: string,
  periodPhrase: string | null
): string {
  if (!periodPhrase) {
    return `${amountLabel} ${currency}`;
  }
  if (periodPhrase.startsWith("for ")) {
    return `${amountLabel} ${currency} ${periodPhrase}`;
  }
  return `${amountLabel} ${currency} ${periodPhrase}`;
}

export function formatOpeningPay(opening: OpeningPayFields): string | null {
  const currency = resolveDisplayCurrency(opening.payCurrency);
  const periodPhrase = formatPeriodPhrase(opening.payPeriod);

  if (hasLegacyPayRange(opening) && opening.payMin != null && opening.payMax != null) {
    const amountLabel = `${formatPayNumber(opening.payMin)} – ${formatPayNumber(opening.payMax)}`;
    return formatAmountWithCurrencyAndPeriod(amountLabel, currency, periodPhrase);
  }

  const amount = getOpeningPayAmount(opening);
  if (amount == null) {
    return null;
  }

  return formatAmountWithCurrencyAndPeriod(
    formatPayNumber(amount),
    currency,
    periodPhrase
  );
}

export function formatOpeningChoiceLabel(opening: {
  role: string;
  area: string;
} & OpeningPayFields): string {
  const pay = formatOpeningPay(opening);
  const label = `${opening.role} — ${opening.area}`;
  return pay ? `${label} · ${pay}` : label;
}

export function joinOpeningContextAndPay(
  context: string | null,
  pay: string | null
): string | null {
  if (context && pay) {
    return `${context} · ${pay}`;
  }
  return context ?? pay;
}
