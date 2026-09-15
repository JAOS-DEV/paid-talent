import type { RecruiterProfile } from "@/lib/db/schema";

export {
  BLURB_MAX_LENGTH,
  OPENING_NOTES_MAX_LENGTH,
} from "./opening-validation";
import {
  BLURB_MAX_LENGTH,
  OPENING_NOTES_MAX_LENGTH,
} from "./opening-validation";

type FieldSpec =
  | keyof RecruiterProfile
  | { any: (keyof RecruiterProfile)[] }
  | { all: (keyof RecruiterProfile)[] };

export interface RecruiterOnboardingStep {
  id: string;
  title: string;
  description: string;
  field: FieldSpec;
  isRequired: boolean;
}

export const RECRUITER_ONBOARDING_STEPS: RecruiterOnboardingStep[] = [
  {
    id: "venue",
    title: "Venue / Org Name",
    description: "Name of your venue or organization",
    field: "organizationName",
    isRequired: true,
  },
  {
    id: "area",
    title: "Area",
    description: "Primary area where you operate",
    field: "area",
    isRequired: true,
  },
  {
    id: "blurb",
    title: "About Your Venue",
    description: "Short description (max 240 characters)",
    field: "blurb",
    isRequired: true,
  },
  {
    id: "logo",
    title: "Logo / Photo",
    description: "Optional logo or venue photo",
    field: "logoUrl",
    isRequired: false,
  },
  {
    id: "contact",
    title: "Contact Info",
    description: "Optional contact details",
    field: { any: ["contactEmail", "contactPhone"] },
    isRequired: false,
  },
];

export interface RecruiterProfileCompleteness {
  isComplete: boolean;
  completedSteps: string[];
  nextStep: string | null;
  progress: number;
}

function isSingleFieldComplete(
  profile: RecruiterProfile,
  field: keyof RecruiterProfile
): boolean {
  const value = profile[field];
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function isFieldComplete(
  profile: RecruiterProfile,
  field: FieldSpec
): boolean {
  if (typeof field === "string") {
    return isSingleFieldComplete(profile, field);
  }

  if ("any" in field) {
    return field.any.some((f) => isSingleFieldComplete(profile, f));
  }

  if ("all" in field) {
    return field.all.every((f) => isSingleFieldComplete(profile, f));
  }

  return false;
}

export function getRecruiterProfileCompleteness(
  profile: RecruiterProfile | null
): RecruiterProfileCompleteness {
  if (!profile) {
    return {
      isComplete: false,
      completedSteps: [],
      nextStep: RECRUITER_ONBOARDING_STEPS[0].id,
      progress: 0,
    };
  }

  const completedSteps: string[] = [];
  let nextStep: string | null = null;

  for (const step of RECRUITER_ONBOARDING_STEPS) {
    const complete = isFieldComplete(profile, step.field);
    if (complete) {
      completedSteps.push(step.id);
    } else if (step.isRequired && !nextStep) {
      nextStep = step.id;
    }
  }

  const requiredSteps = RECRUITER_ONBOARDING_STEPS.filter((s) => s.isRequired);
  const completedRequired = requiredSteps.filter((s) =>
    completedSteps.includes(s.id)
  );
  const progress = Math.round(
    (completedRequired.length / requiredSteps.length) * 100
  );

  return {
    isComplete: completedRequired.length === requiredSteps.length,
    completedSteps,
    nextStep,
    progress,
  };
}

export function isRecruiterProfileComplete(
  profile: RecruiterProfile | null
): boolean {
  return getRecruiterProfileCompleteness(profile).isComplete;
}

export function validateBlurbLength(blurb: string): boolean {
  return blurb.length <= BLURB_MAX_LENGTH;
}

export function validateOpeningNotesLength(notes: string): boolean {
  return notes.length <= OPENING_NOTES_MAX_LENGTH;
}

export {
  createOpeningSchema,
  updateOpeningSchema,
  updateProfileSchema,
  emptyToUndefined,
  isPayRangeValid,
  normalizeOptionalPay,
  normalizeOptionalText,
  optionalNonNegativePaySchema,
} from "./opening-validation";

export {
  canonicalizePayPeriod,
  DEFAULT_OPENING_PAY_CURRENCY,
  DEFAULT_OPENING_PAY_PERIOD,
  emptyPayToNull,
  formatOpeningChoiceLabel,
  formatOpeningPay,
  getOpeningPayAmount,
  hasLegacyPayRange,
  joinOpeningContextAndPay,
  LEGACY_PAY_RANGE_MESSAGE,
  OPENING_PAY_AMOUNT_MAX,
  OPENING_PAY_CURRENCIES,
  OPENING_PAY_PERIOD_OPTIONS,
  OPENING_PAY_PERIOD_PRESETS,
  parseStoredPayPeriod,
  serializeCustomPayPeriod,
  toOpeningPayStorage,
} from "./opening-pay";
