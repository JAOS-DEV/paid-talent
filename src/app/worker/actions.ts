"use server";

import { auth } from "@/lib/auth";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validateProfileText } from "@/lib/helpers/text-filter";
import { PROFILE_PHOTO_ERRORS } from "@/lib/media/profile-photo";
import { isPersistablePublicMediaUrl } from "@/lib/media/public-url";

const photoSchema = z.object({
  photoKey: z.string().min(1),
  photoUrl: z
    .string()
    .url()
    .refine(isPersistablePublicMediaUrl, {
      message: PROFILE_PHOTO_ERRORS.publicUrlUnavailable,
    }),
});

const nameSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
});

const rolesSchema = z.object({
  jobRoles: z.array(z.string()).min(1, "Select at least one role"),
});

const experienceSchema = z.object({
  experience: z.string().optional(),
  experienceYears: z.coerce.number().min(0).max(50).optional(),
});

const languagesSchema = z.object({
  languages: z.array(z.string()).min(1, "Select at least one language"),
});

const bioSchema = z.object({
  bio: z.string().min(10, "Bio must be at least 10 characters"),
});

const locationSchema = z.object({
  location: z.string().min(2, "Location is required"),
  area: z.string().optional(),
  availability: z.string().min(1, "Availability is required"),
  expectedPayMin: z.coerce.number().min(0).optional(),
  expectedPayMax: z.coerce.number().min(0).optional(),
  payCurrency: z.string().default("USD"),
});

const contactSchema = z.object({
  lineId: z.string().optional(),
  whatsappNumber: z.string().optional(),
  phoneNumber: z.string().optional(),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

async function getAuthenticatedWorker(): Promise<{ userId: string } | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "worker") {
    return null;
  }
  return { userId: session.user.id };
}

export async function updateProfilePhoto(
  data: z.infer<typeof photoSchema>
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = photoSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
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
  data: z.infer<typeof nameSchema>
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = nameSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const textError = validateProfileText(validation.data.displayName);
  if (textError) {
    return { success: false, error: textError.message };
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
  data: z.infer<typeof rolesSchema>
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = rolesSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
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
  data: z.infer<typeof experienceSchema>
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = experienceSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  if (validation.data.experience) {
    const textError = validateProfileText(validation.data.experience);
    if (textError) {
      return { success: false, error: textError.message };
    }
  }

  await db
    .update(workerProfiles)
    .set({
      experience: validation.data.experience ?? null,
      experienceYears: validation.data.experienceYears ?? null,
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
  if (!worker) {
    return { success: false, error: "Unauthorized" };
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
  data: z.infer<typeof bioSchema>
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = bioSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const textError = validateProfileText(validation.data.bio);
  if (textError) {
    return { success: false, error: textError.message };
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
  data: z.infer<typeof locationSchema>
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = locationSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const locationError = validateProfileText(validation.data.location);
  if (locationError) {
    return { success: false, error: locationError.message };
  }

  if (validation.data.area) {
    const areaError = validateProfileText(validation.data.area);
    if (areaError) {
      return { success: false, error: areaError.message };
    }
  }

  await db
    .update(workerProfiles)
    .set({
      location: validation.data.location,
      area: validation.data.area ?? null,
      availability: validation.data.availability,
      expectedPayMin: validation.data.expectedPayMin ?? null,
      expectedPayMax: validation.data.expectedPayMax ?? null,
      payCurrency: validation.data.payCurrency,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function updateProfileContact(
  data: z.infer<typeof contactSchema>
): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = contactSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  await db
    .update(workerProfiles)
    .set({
      lineId: validation.data.lineId || null,
      whatsappNumber: validation.data.whatsappNumber || null,
      phoneNumber: validation.data.phoneNumber || null,
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, worker.userId));

  revalidatePath("/worker/profile");
  revalidatePath("/worker/onboarding");

  return { success: true };
}

export async function publishProfile(): Promise<ActionResult> {
  const worker = await getAuthenticatedWorker();
  if (!worker) {
    return { success: false, error: "Unauthorized" };
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
  if (!worker) {
    return null;
  }

  const [profile] = await db
    .select()
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, worker.userId))
    .limit(1);

  return profile || null;
}
