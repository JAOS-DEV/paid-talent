import { MAX_JOB_ROLES } from "./limits";
import { validatePublicProfileText } from "./public-text";

export const OTHER_JOB_ROLE = "Other";

export const PREDEFINED_JOB_ROLES = [
  "Bartender",
  "Server",
  "Host/Hostess",
  "Barista",
  "Cook",
  "Chef",
  "Dishwasher",
  "Busser",
  "Food Runner",
  "Manager",
  "Cashier",
  "Delivery Driver",
  "Caterer",
  "Event Staff",
  "Dancer",
  "PR / Promotions",
] as const;

export type PredefinedJobRole = (typeof PREDEFINED_JOB_ROLES)[number];

export const JOB_ROLE_OPTIONS = [...PREDEFINED_JOB_ROLES, OTHER_JOB_ROLE];

const PREDEFINED_JOB_ROLE_SET = new Set<string>(PREDEFINED_JOB_ROLES);

export interface SplitJobRoles {
  predefined: string[];
  customRole: string;
  otherSelected: boolean;
}

export function isPredefinedJobRole(role: string): boolean {
  return PREDEFINED_JOB_ROLE_SET.has(role);
}

export function splitStoredJobRoles(
  jobRoles: string[] | null | undefined
): SplitJobRoles {
  const roles = (jobRoles ?? [])
    .map((role) => (typeof role === "string" ? role.trim() : ""))
    .filter((role) => role.length > 0);

  const predefined = [...new Set(roles.filter((role) => isPredefinedJobRole(role)))];
  const customCandidates = roles.filter(
    (role) => !isPredefinedJobRole(role) && role !== OTHER_JOB_ROLE
  );
  const customRole = customCandidates[0] ?? "";
  const otherSelected =
    roles.includes(OTHER_JOB_ROLE) || customRole.length > 0;

  return { predefined, customRole, otherSelected };
}

export function toPersistedJobRoles(
  predefined: string[],
  otherSelected: boolean,
  customRole: string
): string[] {
  const uniquePredefined = [
    ...new Set(
      predefined
        .map((role) => role.trim())
        .filter((role) => isPredefinedJobRole(role))
    ),
  ];
  const trimmedCustom = customRole.trim();

  if (otherSelected && trimmedCustom) {
    return [...uniquePredefined, trimmedCustom];
  }

  return uniquePredefined;
}

export type JobRolesValidationResult =
  | { ok: true; jobRoles: string[] }
  | { ok: false; error: string };

export function normalizeAndValidateJobRoles(input: {
  jobRoles: unknown;
  customJobRole?: unknown;
}): JobRolesValidationResult {
  if (!Array.isArray(input.jobRoles)) {
    return { ok: false, error: "Select at least one role" };
  }

  const rawRoles = input.jobRoles
    .filter((role): role is string => typeof role === "string")
    .map((role) => role.trim())
    .filter((role) => role.length > 0);

  const customFromField =
    typeof input.customJobRole === "string" ? input.customJobRole.trim() : "";

  const predefined = [...new Set(rawRoles.filter((role) => isPredefinedJobRole(role)))];
  const customCandidates = [
    ...new Set(
      rawRoles.filter(
        (role) => !isPredefinedJobRole(role) && role !== OTHER_JOB_ROLE
      )
    ),
  ];

  if (customFromField) {
    customCandidates.push(customFromField);
  }

  const uniqueCustom = [...new Set(customCandidates.filter(Boolean))];
  const otherSelected = rawRoles.includes(OTHER_JOB_ROLE) || uniqueCustom.length > 0;

  if (uniqueCustom.length > 1) {
    return { ok: false, error: "Only one custom Other role is allowed" };
  }

  if (otherSelected && uniqueCustom.length === 0) {
    return {
      ok: false,
      error: "Enter a custom role when Other is selected",
    };
  }

  if (uniqueCustom.length === 1) {
    const customError = validatePublicProfileText(
      uniqueCustom[0],
      "customJobRole"
    );
    if (customError) {
      return { ok: false, error: customError.message };
    }
  }

  const persisted = toPersistedJobRoles(
    predefined,
    otherSelected,
    uniqueCustom[0] ?? ""
  );

  if (persisted.length === 0) {
    return { ok: false, error: "Select at least one role" };
  }

  if (persisted.length > MAX_JOB_ROLES) {
    return {
      ok: false,
      error: `You can select up to ${MAX_JOB_ROLES} job roles`,
    };
  }

  return { ok: true, jobRoles: persisted };
}
