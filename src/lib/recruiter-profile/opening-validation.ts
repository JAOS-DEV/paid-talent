import { z } from "zod";

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
  z.coerce.number().min(0, "Pay must be 0 or greater").optional()
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
  logoKey: z.preprocess(emptyToUndefined, z.string().optional()),
  logoUrl: z.union([z.literal(""), z.string().url()]).optional(),
  contactEmail: z.union([z.literal(""), z.string().email()]).optional(),
  contactPhone: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(20).optional()
  ),
});

const openingFieldsSchema = z.object({
  role: z.string().trim().min(1, "Role is required").max(100),
  area: z.string().trim().min(1, "Area is required").max(100),
  payMin: optionalNonNegativePaySchema,
  payMax: optionalNonNegativePaySchema,
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

function refinePayRange<T extends { payMin?: number; payMax?: number }>(
  data: T,
  ctx: z.RefinementCtx
): void {
  if (
    data.payMin !== undefined &&
    data.payMax !== undefined &&
    data.payMin > data.payMax
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Minimum pay cannot exceed maximum pay",
      path: ["payMin"],
    });
  }
}

export const createOpeningSchema = openingFieldsSchema.superRefine(
  refinePayRange
);

export const updateOpeningSchema = openingFieldsSchema
  .extend({
    id: z.string().uuid(),
  })
  .superRefine(refinePayRange);

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
