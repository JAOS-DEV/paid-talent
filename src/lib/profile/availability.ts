export const AVAILABILITY_OPTIONS = [
  "Full-time",
  "Part-time",
  "Weekends only",
  "Evenings only",
  "Flexible",
  "On-call",
] as const;

export type AvailabilityOption = (typeof AVAILABILITY_OPTIONS)[number];

const AVAILABILITY_OPTION_SET = new Set<string>(AVAILABILITY_OPTIONS);

export const MAX_AVAILABILITY_SELECTIONS = AVAILABILITY_OPTIONS.length;

export function isAvailabilityOption(value: string): value is AvailabilityOption {
  return AVAILABILITY_OPTION_SET.has(value);
}

/**
 * JS equivalent of the SQL scalar -> jsonb[] conversion.
 * NULL / empty => []; "Full-time" => ["Full-time"].
 */
export function migrateScalarAvailability(
  value: string | null | undefined
): string[] {
  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  return [trimmed];
}

export function normalizeAvailability(
  values: string[] | null | undefined
): AvailabilityOption[] {
  const unique = new Set(
    (values ?? [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
  );

  return AVAILABILITY_OPTIONS.filter((option) => unique.has(option));
}

export function hasAvailability(
  values: string[] | null | undefined
): boolean {
  return normalizeAvailability(values).length > 0;
}

export type AvailabilityValidationResult =
  | { ok: true; availability: AvailabilityOption[] }
  | { ok: false; error: string };

export function normalizeAndValidateAvailability(
  values: unknown
): AvailabilityValidationResult {
  if (!Array.isArray(values)) {
    return { ok: false, error: "Availability is required" };
  }

  const trimmed = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (trimmed.some((value) => !isAvailabilityOption(value))) {
    return {
      ok: false,
      error: "Select availability from the supported options",
    };
  }

  const normalized = normalizeAvailability(trimmed);

  if (normalized.length === 0) {
    return { ok: false, error: "Availability is required" };
  }

  if (normalized.length > MAX_AVAILABILITY_SELECTIONS) {
    return {
      ok: false,
      error: "Too many availability options selected",
    };
  }

  return { ok: true, availability: normalized };
}

export function availabilityMatchesFilter(
  values: string[] | null | undefined,
  filter: string | undefined
): boolean {
  if (!filter) {
    return true;
  }

  const needle = filter.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return (values ?? []).some(
    (value) => value.trim().toLowerCase() === needle
  );
}
