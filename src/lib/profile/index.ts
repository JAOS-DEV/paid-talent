import type { WorkerProfile } from "@/lib/db/schema";

export const INCOMPLETE_PROFILE_REDIRECT_THRESHOLD = 30;

export type ProfileCompletenessSource = Pick<
  WorkerProfile,
  | "photoUrl"
  | "displayName"
  | "jobRoles"
  | "experience"
  | "experienceYears"
  | "languages"
  | "bio"
  | "location"
  | "availability"
  | "lineId"
  | "whatsappNumber"
  | "phoneNumber"
> & {
  hasSubmittedPhoto?: boolean;
};

type FieldSpec =
  | keyof ProfileCompletenessSource
  | { any: (keyof ProfileCompletenessSource)[] }
  | { all: (keyof ProfileCompletenessSource)[] };

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  field: FieldSpec;
  isRequired: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "photo",
    title: "Profile Photo",
    description: "Add a professional photo",
    field: "photoUrl",
    isRequired: true,
  },
  {
    id: "name",
    title: "Your Name",
    description: "How you want to be called",
    field: "displayName",
    isRequired: true,
  },
  {
    id: "roles",
    title: "Job Roles",
    description: "What roles can you fill?",
    field: "jobRoles",
    isRequired: true,
  },
  {
    id: "experience",
    title: "Experience",
    description: "Your work experience",
    field: { any: ["experience", "experienceYears"] },
    isRequired: true,
  },
  {
    id: "languages",
    title: "Languages",
    description: "Languages you speak",
    field: "languages",
    isRequired: true,
  },
  {
    id: "bio",
    title: "About You",
    description: "Tell recruiters about yourself",
    field: "bio",
    isRequired: true,
  },
  {
    id: "location",
    title: "Location & Pay",
    description: "Where and when you can work",
    field: { all: ["location", "availability"] },
    isRequired: true,
  },
  {
    id: "contact",
    title: "Contact Methods",
    description: "Optional ways to reach you",
    field: { any: ["lineId", "whatsappNumber", "phoneNumber"] },
    isRequired: false,
  },
];

export interface ProfileCompleteness {
  isComplete: boolean;
  completedSteps: string[];
  nextStep: string | null;
  progress: number;
}

function isSingleFieldComplete(
  profile: ProfileCompletenessSource,
  field: keyof WorkerProfile | "hasSubmittedPhoto"
): boolean {
  if (field === "photoUrl") {
    if (profile.hasSubmittedPhoto === true) {
      return true;
    }
  }

  if (field === "hasSubmittedPhoto") {
    return profile.hasSubmittedPhoto === true;
  }

  const value = profile[field as keyof ProfileCompletenessSource];
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function isFieldComplete(
  profile: ProfileCompletenessSource,
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

export function getProfileCompleteness(
  profile: ProfileCompletenessSource | null
): ProfileCompleteness {
  if (!profile) {
    return {
      isComplete: false,
      completedSteps: [],
      nextStep: ONBOARDING_STEPS[0].id,
      progress: 0,
    };
  }

  const completedSteps: string[] = [];
  let nextStep: string | null = null;

  for (const step of ONBOARDING_STEPS) {
    const complete = isFieldComplete(profile, step.field);
    if (complete) {
      completedSteps.push(step.id);
    } else if (step.isRequired && !nextStep) {
      nextStep = step.id;
    }
  }

  const requiredSteps = ONBOARDING_STEPS.filter((s) => s.isRequired);
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

export function getStepIndex(stepId: string): number {
  return ONBOARDING_STEPS.findIndex((s) => s.id === stepId);
}

export function getNextStepId(currentStepId: string): string | null {
  const currentIndex = getStepIndex(currentStepId);
  if (currentIndex < 0 || currentIndex >= ONBOARDING_STEPS.length - 1) {
    return null;
  }
  return ONBOARDING_STEPS[currentIndex + 1].id;
}

export function getPreviousStepId(currentStepId: string): string | null {
  const currentIndex = getStepIndex(currentStepId);
  if (currentIndex <= 0) {
    return null;
  }
  return ONBOARDING_STEPS[currentIndex - 1].id;
}

export const JOB_ROLE_OPTIONS = [
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
  "Other",
];

export const LANGUAGE_OPTIONS = [
  "English",
  "Thai",
  "Japanese",
  "Korean",
  "Chinese (Mandarin)",
  "Chinese (Cantonese)",
  "Vietnamese",
  "Tagalog",
  "Indonesian",
  "Malay",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Russian",
  "Arabic",
  "Portuguese",
  "Other",
];

export const AVAILABILITY_OPTIONS = [
  "Full-time",
  "Part-time",
  "Weekends only",
  "Evenings only",
  "Flexible",
  "On-call",
];
