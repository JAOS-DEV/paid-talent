import type { WorkerProfile } from "@/lib/db/schema";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  field: keyof WorkerProfile | (keyof WorkerProfile)[];
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
    field: ["experience", "experienceYears"],
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
    field: ["location", "availability", "expectedPayMin"],
    isRequired: true,
  },
  {
    id: "contact",
    title: "Contact Methods",
    description: "Optional ways to reach you",
    field: ["lineId", "whatsappNumber", "phoneNumber"],
    isRequired: false,
  },
];

export interface ProfileCompleteness {
  isComplete: boolean;
  completedSteps: string[];
  nextStep: string | null;
  progress: number;
}

function isFieldComplete(
  profile: WorkerProfile,
  field: keyof WorkerProfile | (keyof WorkerProfile)[]
): boolean {
  if (Array.isArray(field)) {
    return field.some((f) => isFieldComplete(profile, f));
  }

  const value = profile[field];
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function getProfileCompleteness(
  profile: WorkerProfile | null
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
