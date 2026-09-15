import { z } from "zod";
import {
  DEFAULT_WORKER_PAY_CURRENCY,
  EXPERIENCE_YEARS_MAX,
  EXPERIENCE_YEARS_MIN,
  MAX_JOB_ROLES,
} from "./limits";
import { AVAILABILITY_OPTIONS } from "./availability";
import { normalizeAndValidateAvailability } from "./availability";
import { normalizeAndValidateContactMethods } from "./contact-methods";
import { normalizeAndValidateJobRoles } from "./job-roles";
import { validatePublicProfileText } from "./public-text";

export type WorkerProfileInputResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const nameInputSchema = z.object({
  displayName: z.string(),
});

export const rolesInputSchema = z.object({
  jobRoles: z
    .array(z.string())
    .min(1, "Select at least one role")
    .max(MAX_JOB_ROLES, `You can select up to ${MAX_JOB_ROLES} job roles`),
  customJobRole: z.string().optional(),
});

export const experienceInputSchema = z.object({
  experience: z.string().optional(),
  experienceYears: z.coerce
    .number()
    .min(EXPERIENCE_YEARS_MIN)
    .max(EXPERIENCE_YEARS_MAX)
    .optional(),
});

export const languagesInputSchema = z.object({
  languages: z.array(z.string()).min(1, "Select at least one language"),
});

export const bioInputSchema = z.object({
  bio: z.string(),
});

export const locationInputSchema = z.object({
  location: z.string(),
  area: z.string().optional(),
  availability: z
    .array(z.enum(AVAILABILITY_OPTIONS))
    .min(1, "Availability is required")
    .max(AVAILABILITY_OPTIONS.length),
  expectedPayMin: z.coerce.number().min(0).optional(),
  expectedPayMax: z.coerce.number().min(0).optional(),
  payCurrency: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .default(DEFAULT_WORKER_PAY_CURRENCY),
});

export const contactInputSchema = z.object({
  lineId: z.string().optional(),
  whatsappNumber: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export function parseProfileName(
  data: unknown
): WorkerProfileInputResult<{ displayName: string }> {
  const parsed = nameInputSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const error = validatePublicProfileText(parsed.data.displayName, "displayName");
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { displayName: parsed.data.displayName.trim() } };
}

export function parseProfileRoles(
  data: unknown
): WorkerProfileInputResult<{ jobRoles: string[] }> {
  if (
    data &&
    typeof data === "object" &&
    "jobRoles" in data &&
    Array.isArray((data as { jobRoles: unknown }).jobRoles) &&
    (data as { jobRoles: unknown[] }).jobRoles.length > MAX_JOB_ROLES
  ) {
    return {
      ok: false,
      error: `You can select up to ${MAX_JOB_ROLES} job roles`,
    };
  }

  const parsed = rolesInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Select at least one role",
    };
  }

  const normalized = normalizeAndValidateJobRoles(parsed.data);
  if (!normalized.ok) {
    return normalized;
  }

  return { ok: true, data: { jobRoles: normalized.jobRoles } };
}

export function parseProfileExperience(
  data: unknown
): WorkerProfileInputResult<{
  experience: string | null;
  experienceYears: number | null;
}> {
  const parsed = experienceInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid experience",
    };
  }

  const experience =
    typeof parsed.data.experience === "string"
      ? parsed.data.experience.trim()
      : "";

  if (experience) {
    const error = validatePublicProfileText(experience, "experience");
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  const experienceYears = parsed.data.experienceYears;
  if (experienceYears === undefined && !experience) {
    return {
      ok: false,
      error: "Please provide your experience or years",
    };
  }

  return {
    ok: true,
    data: {
      experience: experience || null,
      experienceYears: experienceYears ?? null,
    },
  };
}

export function parseProfileBio(
  data: unknown
): WorkerProfileInputResult<{ bio: string }> {
  const parsed = bioInputSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid bio" };
  }

  const error = validatePublicProfileText(parsed.data.bio, "bio");
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { bio: parsed.data.bio.trim() } };
}

export function parseProfileLocation(
  data: unknown
): WorkerProfileInputResult<{
  location: string;
  area: string | null;
  availability: string[];
  expectedPayMin: number | null;
  expectedPayMax: number | null;
  payCurrency: string;
}> {
  const parsed = locationInputSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.[0];
    if (path === "availability") {
      const availability = normalizeAndValidateAvailability(
        data && typeof data === "object" && "availability" in data
          ? (data as { availability: unknown }).availability
          : undefined
      );
      if (!availability.ok) {
        return availability;
      }
    }
    return {
      ok: false,
      error: issue?.message ?? "Invalid location details",
    };
  }

  const locationError = validatePublicProfileText(
    parsed.data.location,
    "location"
  );
  if (locationError) {
    return { ok: false, error: locationError.message };
  }

  const area = parsed.data.area?.trim() || "";
  if (area) {
    const areaError = validatePublicProfileText(area, "area");
    if (areaError) {
      return { ok: false, error: areaError.message };
    }
  }

  const availability = normalizeAndValidateAvailability(parsed.data.availability);
  if (!availability.ok) {
    return availability;
  }

  return {
    ok: true,
    data: {
      location: parsed.data.location.trim(),
      area: area || null,
      availability: availability.availability,
      expectedPayMin: parsed.data.expectedPayMin ?? null,
      expectedPayMax: parsed.data.expectedPayMax ?? null,
      payCurrency: parsed.data.payCurrency || DEFAULT_WORKER_PAY_CURRENCY,
    },
  };
}

export function parseProfileContact(
  data: unknown
): WorkerProfileInputResult<{
  lineId: string | null;
  whatsappNumber: string | null;
  phoneNumber: string | null;
}> {
  const parsed = contactInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid contact details",
    };
  }

  const contact = normalizeAndValidateContactMethods(parsed.data);
  if (!contact.ok) {
    return contact;
  }

  return { ok: true, data: contact.contact };
}
