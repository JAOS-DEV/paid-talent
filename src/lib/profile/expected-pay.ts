import { DEFAULT_WORKER_PAY_CURRENCY } from "./limits";

export const WORKER_EXPECTED_PAY_PERIODS = ["day", "month"] as const;

export type WorkerExpectedPayPeriod =
  (typeof WORKER_EXPECTED_PAY_PERIODS)[number];

export const DEFAULT_WORKER_EXPECTED_PAY_PERIOD: WorkerExpectedPayPeriod =
  "day";

export const WORKER_EXPECTED_PAY_AMOUNT_MAX = 10_000_000;

export const WORKER_EXPECTED_PAY_PERIOD_OPTIONS: readonly {
  value: WorkerExpectedPayPeriod;
  label: string;
}[] = [
  { value: "day", label: "per day" },
  { value: "month", label: "per month" },
] as const;

export interface WorkerExpectedPayFields {
  expectedPayMin?: number | null;
  /** @deprecated Legacy range max; no longer written. */
  expectedPayMax?: number | null;
  payCurrency?: string | null;
  expectedPayPeriod?: string | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  THB: "฿",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

function isPayPeriod(value: string): value is WorkerExpectedPayPeriod {
  return (WORKER_EXPECTED_PAY_PERIODS as readonly string[]).includes(value);
}

export function parseWorkerExpectedPayPeriod(
  value: string | null | undefined
): WorkerExpectedPayPeriod | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  return isPayPeriod(trimmed) ? trimmed : null;
}

export function getWorkerExpectedPayAmount(
  fields: WorkerExpectedPayFields
): number | null {
  if (fields.expectedPayMin != null) {
    return fields.expectedPayMin;
  }
  if (fields.expectedPayMax != null) {
    return fields.expectedPayMax;
  }
  return null;
}

export function toWorkerExpectedPayStorage(
  amount: number | null,
  period: WorkerExpectedPayPeriod | null
): {
  expectedPayMin: number | null;
  expectedPayMax: null;
  expectedPayPeriod: WorkerExpectedPayPeriod | null;
} {
  if (amount == null) {
    return {
      expectedPayMin: null,
      expectedPayMax: null,
      expectedPayPeriod: null,
    };
  }
  return {
    expectedPayMin: amount,
    expectedPayMax: null,
    expectedPayPeriod: period ?? DEFAULT_WORKER_EXPECTED_PAY_PERIOD,
  };
}

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency;
}

function resolveDisplayCurrency(value: string | null | undefined): string {
  if (!value) {
    return DEFAULT_WORKER_PAY_CURRENCY;
  }
  const normalized = value.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }
  return DEFAULT_WORKER_PAY_CURRENCY;
}

const TEASER_PAY_BAND_STEP = 500;

/**
 * Rounded-down pay floor for locked non-Top-Talent teasers, e.g. "฿1,000+".
 * Exact amounts stay off the teaser payload.
 */
export function formatTeaserPayBand(
  amount: number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (amount == null || !Number.isFinite(amount)) {
    return null;
  }
  const rounded =
    Math.floor(amount / TEASER_PAY_BAND_STEP) * TEASER_PAY_BAND_STEP;
  if (rounded < TEASER_PAY_BAND_STEP) {
    return null;
  }
  const symbol = getCurrencySymbol(resolveDisplayCurrency(currency));
  return `${symbol}${rounded.toLocaleString("en-US")}+`;
}

/**
 * Formats worker expected pay as "฿15,000 / day" or "฿15,000 / month".
 */
export function formatWorkerExpectedPay(
  fields: WorkerExpectedPayFields
): string | null {
  const amount = getWorkerExpectedPayAmount(fields);
  if (amount == null) {
    return null;
  }

  const currency = resolveDisplayCurrency(fields.payCurrency);
  const symbol = getCurrencySymbol(currency);
  const amountLabel = amount.toLocaleString("en-US");
  const period =
    parseWorkerExpectedPayPeriod(fields.expectedPayPeriod) ??
    DEFAULT_WORKER_EXPECTED_PAY_PERIOD;

  return `${symbol}${amountLabel} / ${period}`;
}

/**
 * True when a recruiter pay filter should match this worker.
 * Compares amounts only within the same period.
 */
export function matchesExpectedPayFilter(
  fields: WorkerExpectedPayFields,
  filter: { maxPay?: number; payPeriod?: WorkerExpectedPayPeriod }
): boolean {
  if (filter.maxPay == null && filter.payPeriod == null) {
    return true;
  }

  const amount = getWorkerExpectedPayAmount(fields);
  const period = parseWorkerExpectedPayPeriod(fields.expectedPayPeriod);
  if (amount == null || period == null) {
    return false;
  }

  if (filter.payPeriod != null && period !== filter.payPeriod) {
    return false;
  }

  if (filter.maxPay != null && amount > filter.maxPay) {
    return false;
  }

  return true;
}
