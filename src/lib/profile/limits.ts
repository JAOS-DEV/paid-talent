export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 80;

export const CUSTOM_JOB_ROLE_MIN_LENGTH = 2;
export const CUSTOM_JOB_ROLE_MAX_LENGTH = 40;
export const MAX_JOB_ROLES = 8;

export const EXPERIENCE_DESCRIPTION_MAX_LENGTH = 500;
export const EXPERIENCE_YEARS_MIN = 0;
export const EXPERIENCE_YEARS_MAX = 50;

export const BIO_MIN_LENGTH = 10;
export const BIO_MAX_LENGTH = 500;

export const LOCATION_MIN_LENGTH = 2;
export const LOCATION_MAX_LENGTH = 100;
export const AREA_MAX_LENGTH = 100;

export const LINE_ID_MAX_LENGTH = 32;
export const WHATSAPP_MAX_LENGTH = 20;
export const PHONE_NUMBER_MAX_LENGTH = 20;
export const CONTACT_PHONE_MIN_DIGITS = 8;

export const DEFAULT_WORKER_PAY_CURRENCY = "THB";

export const WORKER_PAY_CURRENCIES = [
  "THB",
  "USD",
  "EUR",
  "GBP",
  "JPY",
] as const;

export type WorkerPayCurrency = (typeof WORKER_PAY_CURRENCIES)[number];

export function workerPayCurrencyOptions(
  current: string | null | undefined
): string[] {
  const value = current?.trim();
  if (value && !(WORKER_PAY_CURRENCIES as readonly string[]).includes(value)) {
    return [value, ...WORKER_PAY_CURRENCIES];
  }
  return [...WORKER_PAY_CURRENCIES];
}
