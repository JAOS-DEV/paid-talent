"use server";

import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PROFILE_PHOTO_ERRORS } from "@/lib/media/profile-photo";
import { isPersistablePublicMediaUrl } from "@/lib/media/public-url";
import { assertOwnedPublicProfilePhotoKey } from "@/lib/storage/keys";
import {
  actionAuthError,
  requireActiveWorker,
} from "@/lib/auth/require-active-user";
import {
  parseProfileBio,
  parseProfileContact,
  parseProfileExperience,
  parseProfileLocation,
  parseProfileName,
  parseProfileRoles,
} from "@/lib/profile/worker-profile-input";

const photoSchema = z.object({
  photoKey: z.string().min(1),
  photoUrl: z
    .string()
    .url()
    .refine(isPersistablePublicMediaUrl, {
      message: PROFILE_PHOTO_ERRORS.publicUrlUnavailable,
    }),
});

const languagesSchema = z.object({
  languages: z.array(z.string()).min(1, "Select at least one language"),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

async function getAuthenticatedWorker(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const result = await requireActiveWorker();
  if (!result.ok) {
    return actionAuthError(result);
  }
  return { ok: true, userId: result.user.userId };
}

export async function updateProfilePhoto(
  data: z.infer<typeof photoSchema>
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const validation = photoSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    assertOwnedPublicProfilePhotoKey(worker.userId, validation.data.photoKey);
  } catch {
    return { success: false, error: PROFILE_PHOTO_ERRORS.uploadFailed };
  }

  await db
    .update(workerProfiles)
    .set({
      photoKey: validation.data.photoKey,
      photoUrl: validation.data.photoUrl,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function updateProfileName(
  data: unknown
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const validation = parseProfileName(data);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  await db
    .update(workerProfiles)
    .set({
      displayName: validation.data.displayName,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function updateProfileRoles(
  data: unknown
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const validation = parseProfileRoles(data);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  await db
    .update(workerProfiles)
    .set({
      jobRoles: validation.data.jobRoles,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function updateProfileExperience(
  data: unknown
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const validation = parseProfileExperience(data);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  await db
    .update(workerProfiles)
    .set({
      experience: validation.data.experience,
      experienceYears: validation.data.experienceYears,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function updateProfileLanguages(
  data: z.infer<typeof languagesSchema>
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const validation = languagesSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  await db
    .update(workerProfiles)
    .set({
      languages: validation.data.languages,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function updateProfileBio(
  data: unknown
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const validation = parseProfileBio(data);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  await db
    .update(workerProfiles)
    .set({
      bio: validation.data.bio,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function updateProfileLocation(
  data: unknown
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const validation = parseProfileLocation(data);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  await db
    .update(workerProfiles)
    .set({
      location: validation.data.location,
      area: validation.data.area,
      availability: validation.data.availability,
      expectedPayMin: validation.data.expectedPayMin,
      expectedPayMax: validation.data.expectedPayMax,
      payCurrency: validation.data.payCurrency,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function updateProfileBasicInfo(
  data: unknown
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const name = parseProfileName(
    data && typeof data === "object"
      ? { displayName: (data as { displayName?: unknown }).displayName }
      : data
  );
  if (!name.ok) {
    return { success: false, error: name.error };
  }

  const location = parseProfileLocation(data);
  if (!location.ok) {
    return { success: false, error: location.error };
  }

  await db
    .update(workerProfiles)
    .set({
      displayName: name.data.displayName,
      location: location.data.location,
      area: location.data.area,
      availability: location.data.availability,
      expectedPayMin: location.data.expectedPayMin,
      expectedPayMax: location.data.expectedPayMax,
      payCurrency: location.data.payCurrency,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function updateProfileWorkDetails(
  data: unknown
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const payload =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  const roles = parseProfileRoles({
    jobRoles: payload.jobRoles,
    customJobRole: payload.customJobRole,
  });
  if (!roles.ok) {
    return { success: false, error: roles.error };
  }

  const experience = parseProfileExperience({
    experience: payload.experience,
    experienceYears: payload.experienceYears,
  });
  if (!experience.ok) {
    return { success: false, error: experience.error };
  }

  const languages = languagesSchema.safeParse({
    languages: payload.languages,
  });
  if (!languages.success) {
    return {
      success: false,
      error: languages.error.issues[0]?.message ?? "Select at least one language",
    };
  }

  const bio = parseProfileBio({ bio: payload.bio });
  if (!bio.ok) {
    return { success: false, error: bio.error };
  }

  await db
    .update(workerProfiles)
    .set({
      jobRoles: roles.data.jobRoles,
      experience: experience.data.experience,
      experienceYears: experience.data.experienceYears,
      languages: languages.data.languages,
      bio: bio.data.bio,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function updateProfileContact(
  data: unknown
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  const validation = parseProfileContact(data);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  await db
    .update(workerProfiles)
    .set({
      lineId: validation.data.lineId,
      whatsappNumber: validation.data.whatsappNumber,
      phoneNumber: validation.data.phoneNumber,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function publishProfile(): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return { success: false, error: worker.error };
  }

  await db
    .update(workerProfiles)
    .set({
      isPublished: true,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/dashboard");

  return { success: true };
}

export async function getWorkerProfile() {
  const worker = await getAuthenticatedWorker();
  if (!worker.ok) {
    return null;
  }

  const [profile] = await db
    .select()
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, worker.userId))
    .limit(1);

  return profile || null;
}
