import {
  containsProfanity,
  PROFANITY_BLOCKED_MESSAGE,
} from "@/lib/helpers/profanity-filter";
import { validateProfileText } from "@/lib/helpers/text-filter";
import {
  AREA_MAX_LENGTH,
  BIO_MAX_LENGTH,
  BIO_MIN_LENGTH,
  CUSTOM_JOB_ROLE_MAX_LENGTH,
  CUSTOM_JOB_ROLE_MIN_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  EXPERIENCE_DESCRIPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  LOCATION_MIN_LENGTH,
} from "./limits";

export type PublicProfileTextField =
  | "displayName"
  | "customJobRole"
  | "experience"
  | "bio"
  | "location"
  | "area";

export type PublicTextViolation =
  | "required"
  | "too_short"
  | "too_long"
  | "blocked_contact"
  | "profanity";

export interface PublicTextValidationError {
  type: PublicTextViolation;
  message: string;
  field: PublicProfileTextField;
}

export const CONTACT_CIRCUMVENTION_MESSAGE =
  "Contact details and social media handles cannot be added here. Use the Contact Methods section instead.";

interface FieldPolicy {
  field: PublicProfileTextField;
  minLength: number;
  maxLength: number;
  required: boolean;
  emptyMessage: string;
  tooShortMessage: string;
  tooLongMessage: string;
}

const FIELD_POLICIES: Record<PublicProfileTextField, FieldPolicy> = {
  displayName: {
    field: "displayName",
    minLength: DISPLAY_NAME_MIN_LENGTH,
    maxLength: DISPLAY_NAME_MAX_LENGTH,
    required: true,
    emptyMessage: "Name must be at least 2 characters",
    tooShortMessage: "Name must be at least 2 characters",
    tooLongMessage: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`,
  },
  customJobRole: {
    field: "customJobRole",
    minLength: CUSTOM_JOB_ROLE_MIN_LENGTH,
    maxLength: CUSTOM_JOB_ROLE_MAX_LENGTH,
    required: true,
    emptyMessage: "Enter a custom role when Other is selected",
    tooShortMessage: "Other role must be at least 2 characters",
    tooLongMessage: `Other role must be ${CUSTOM_JOB_ROLE_MAX_LENGTH} characters or fewer`,
  },
  experience: {
    field: "experience",
    minLength: 0,
    maxLength: EXPERIENCE_DESCRIPTION_MAX_LENGTH,
    required: false,
    emptyMessage: "",
    tooShortMessage: "",
    tooLongMessage: `Experience description must be ${EXPERIENCE_DESCRIPTION_MAX_LENGTH} characters or fewer`,
  },
  bio: {
    field: "bio",
    minLength: BIO_MIN_LENGTH,
    maxLength: BIO_MAX_LENGTH,
    required: true,
    emptyMessage: `Bio must be at least ${BIO_MIN_LENGTH} characters`,
    tooShortMessage: `Bio must be at least ${BIO_MIN_LENGTH} characters`,
    tooLongMessage: `Bio must be ${BIO_MAX_LENGTH} characters or fewer`,
  },
  location: {
    field: "location",
    minLength: LOCATION_MIN_LENGTH,
    maxLength: LOCATION_MAX_LENGTH,
    required: true,
    emptyMessage: "Location is required",
    tooShortMessage: "Location is required",
    tooLongMessage: `Location must be ${LOCATION_MAX_LENGTH} characters or fewer`,
  },
  area: {
    field: "area",
    minLength: 0,
    maxLength: AREA_MAX_LENGTH,
    required: false,
    emptyMessage: "",
    tooShortMessage: "",
    tooLongMessage: `Area must be ${AREA_MAX_LENGTH} characters or fewer`,
  },
};

export function getPublicTextMaxLength(
  field: PublicProfileTextField
): number {
  return FIELD_POLICIES[field].maxLength;
}

/**
 * Authoritative server-side validator for public Worker profile free-text.
 * Combines length limits, contact/paywall circumvention, and profanity checks.
 * Never silently rewrites prohibited text.
 */
export function validatePublicProfileText(
  text: string | null | undefined,
  field: PublicProfileTextField
): PublicTextValidationError | null {
  const policy = FIELD_POLICIES[field];
  const raw = typeof text === "string" ? text : "";
  const trimmed = raw.trim();

  if (!trimmed) {
    if (policy.required) {
      return {
        type: "required",
        field,
        message: policy.emptyMessage,
      };
    }
    return null;
  }

  if (trimmed.length < policy.minLength) {
    return {
      type: "too_short",
      field,
      message: policy.tooShortMessage,
    };
  }

  if (trimmed.length > policy.maxLength) {
    return {
      type: "too_long",
      field,
      message: policy.tooLongMessage,
    };
  }

  const contactError = validateProfileText(trimmed);
  if (contactError) {
    return {
      type: "blocked_contact",
      field,
      message: CONTACT_CIRCUMVENTION_MESSAGE,
    };
  }

  if (containsProfanity(trimmed)) {
    return {
      type: "profanity",
      field,
      message: PROFANITY_BLOCKED_MESSAGE,
    };
  }

  return null;
}
