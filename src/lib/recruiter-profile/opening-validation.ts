import { z } from "zod";
import {
  canonicalizePayPeriod,
  DEFAULT_OPENING_PAY_CURRENCY,
  DEFAULT_OPENING_PAY_PERIOD,
  OPENING_PAY_AMOUNT_MAX,
  OPENING_PAY_CURRENCIES,
} from "./opening-pay";

export const BLURB_MAX_LENGTH = 240;
export const OPENING_NOTES_MAX_LENGTH = 500;

/** Empty optional form values become undefined (not coerced to 0). */
export function emptyToUndefined(value: unknown): unknown {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

export const optionalNonNegativePaySchema = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .finite("Pay must be a valid number")
    .int("Pay must be a whole number")
    .min(0, "Pay must be 0 or greater")
    .max(
      OPENING_PAY_AMOUNT_MAX,
      `Pay must be ${OPENING_PAY_AMOUNT_MAX.toLocaleString("en-US")} or less`
    )
    .optional()
);

export function isPayRangeValid(
  payMin: number | null | undefined,
  payMax: number | null | undefined
): boolean {
  if (payMin == null || payMax == null) {
    return true;
  }
  return payMin <= payMax;
}

export const updateProfileSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Venue/org name is required")
    .max(100),
  area: z.string().trim().min(1, "Area is required").max(100),
  subArea: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(100).optional()
  ),
  blurb: z
    .string()
    .trim()
    .min(1, "Blurb is required")
    .max(
      BLURB_MAX_LENGTH,
      `Blurb must be ${BLURB_MAX_LENGTH} characters or less`
    ),
  contactEmail: z.union([z.literal(""), z.string().email()]).optional(),
  contactPhone: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(20).optional()
  ),
});

const openingPayCurrencySchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return DEFAULT_OPENING_PAY_CURRENCY;
  }
  if (typeof value === "string") {
    return value.trim().toUpperCase();
  }
  return value;
}, z.enum(OPENING_PAY_CURRENCIES));

const openingPayPeriodSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return DEFAULT_OPENING_PAY_PERIOD;
  }
  if (typeof value !== "string") {
    return value;
  }
  return canonicalizePayPeriod(value) ?? value;
}, z.string().refine((value) => canonicalizePayPeriod(value) === value, {
  message: "Pay period is invalid",
}));

const openingFieldsSchema = z.object({
  role: z.string().trim().min(1, "Role is required").max(100),
  area: z.string().trim().min(1, "Area is required").max(100),
  payAmount: optionalNonNegativePaySchema,
  payCurrency: openingPayCurrencySchema,
  payPeriod: openingPayPeriodSchema,
  notes: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(
        OPENING_NOTES_MAX_LENGTH,
        `Notes must be ${OPENING_NOTES_MAX_LENGTH} characters or less`
      )
      .optional()
  ),
  isPublished: z.boolean().default(false),
});

export const createOpeningSchema = openingFieldsSchema;

export const updateOpeningSchema = openingFieldsSchema.extend({
  id: z.string().uuid(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateOpeningInput = z.infer<typeof createOpeningSchema>;
export type UpdateOpeningInput = z.infer<typeof updateOpeningSchema>;

export function normalizeOptionalPay(
  value: number | undefined
): number | null {
  return value === undefined ? null : value;
}

export function normalizeOptionalText(
  value: string | undefined
): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
