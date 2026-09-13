"use server";

import { auth } from "@/lib/auth";
import { db, recruiterProfiles, recruiterOpenings } from "@/lib/db";
import type { RecruiterOpening } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  createOpeningSchema,
  normalizeOptionalPay,
  normalizeOptionalText,
  updateOpeningSchema,
  updateProfileSchema,
} from "./opening-validation";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface ActionResultWithData<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getAuthenticatedRecruiter(): Promise<{
  userId: string;
  recruiterProfileId: string;
} | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "recruiter") {
    return null;
  }

  const [profile] = await db
    .select({ id: recruiterProfiles.id })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, session.user.id))
    .limit(1);

  if (!profile) {
    return null;
  }

  return { userId: session.user.id, recruiterProfileId: profile.id };
}

export async function updateRecruiterProfile(
  data: unknown
): Promise<ActionResult> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = updateProfileSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const {
    organizationName,
    area,
    subArea,
    blurb,
    logoKey,
    logoUrl,
    contactEmail,
    contactPhone,
  } = validation.data;

  await db
    .update(recruiterProfiles)
    .set({
      organizationName,
      area,
      subArea: normalizeOptionalText(subArea),
      blurb,
      logoKey: normalizeOptionalText(logoKey),
      logoUrl: logoUrl ? logoUrl : null,
      contactEmail: contactEmail ? contactEmail : null,
      contactPhone: normalizeOptionalText(contactPhone),
      updatedAt: new Date(),
    })
    .where(eq(recruiterProfiles.id, recruiter.recruiterProfileId));

  revalidatePath("/recruiter/profile");
  revalidatePath("/recruiter/dashboard");

  return { success: true };
}

export async function getRecruiterProfile() {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return null;
  }

  const [profile] = await db
    .select()
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.id, recruiter.recruiterProfileId))
    .limit(1);

  return profile || null;
}

export async function createOpening(
  data: unknown
): Promise<ActionResultWithData<RecruiterOpening>> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = createOpeningSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const { role, area, payMin, payMax, notes, isPublished } = validation.data;

  const [opening] = await db
    .insert(recruiterOpenings)
    .values({
      recruiterProfileId: recruiter.recruiterProfileId,
      role,
      area,
      payMin: normalizeOptionalPay(payMin),
      payMax: normalizeOptionalPay(payMax),
      notes: normalizeOptionalText(notes),
      isPublished,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath("/recruiter/openings");
  revalidatePath("/recruiter/dashboard");

  return { success: true, data: opening };
}

export async function updateOpening(data: unknown): Promise<ActionResult> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = updateOpeningSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const { id, role, area, payMin, payMax, notes, isPublished } =
    validation.data;

  const [existingOpening] = await db
    .select({ id: recruiterOpenings.id })
    .from(recruiterOpenings)
    .where(
      and(
        eq(recruiterOpenings.id, id),
        eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId)
      )
    )
    .limit(1);

  if (!existingOpening) {
    return { success: false, error: "Opening not found or unauthorized" };
  }

  await db
    .update(recruiterOpenings)
    .set({
      role,
      area,
      payMin: normalizeOptionalPay(payMin),
      payMax: normalizeOptionalPay(payMax),
      notes: normalizeOptionalText(notes),
      isPublished,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recruiterOpenings.id, id),
        eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId)
      )
    );

  revalidatePath("/recruiter/openings");
  revalidatePath("/recruiter/dashboard");

  return { success: true };
}

export async function deleteOpening(openingId: string): Promise<ActionResult> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return { success: false, error: "Unauthorized" };
  }

  const [existingOpening] = await db
    .select({ id: recruiterOpenings.id })
    .from(recruiterOpenings)
    .where(
      and(
        eq(recruiterOpenings.id, openingId),
        eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId)
      )
    )
    .limit(1);

  if (!existingOpening) {
    return { success: false, error: "Opening not found or unauthorized" };
  }

  await db
    .delete(recruiterOpenings)
    .where(
      and(
        eq(recruiterOpenings.id, openingId),
        eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId)
      )
    );

  revalidatePath("/recruiter/openings");
  revalidatePath("/recruiter/dashboard");

  return { success: true };
}

export async function publishOpening(openingId: string): Promise<ActionResult> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return { success: false, error: "Unauthorized" };
  }

  const [existingOpening] = await db
    .select({ id: recruiterOpenings.id })
    .from(recruiterOpenings)
    .where(
      and(
        eq(recruiterOpenings.id, openingId),
        eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId)
      )
    )
    .limit(1);

  if (!existingOpening) {
    return { success: false, error: "Opening not found or unauthorized" };
  }

  await db
    .update(recruiterOpenings)
    .set({
      isPublished: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recruiterOpenings.id, openingId),
        eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId)
      )
    );

  revalidatePath("/recruiter/openings");
  revalidatePath("/recruiter/dashboard");

  return { success: true };
}

export async function unpublishOpening(
  openingId: string
): Promise<ActionResult> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return { success: false, error: "Unauthorized" };
  }

  const [existingOpening] = await db
    .select({ id: recruiterOpenings.id })
    .from(recruiterOpenings)
    .where(
      and(
        eq(recruiterOpenings.id, openingId),
        eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId)
      )
    )
    .limit(1);

  if (!existingOpening) {
    return { success: false, error: "Opening not found or unauthorized" };
  }

  await db
    .update(recruiterOpenings)
    .set({
      isPublished: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recruiterOpenings.id, openingId),
        eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId)
      )
    );

  revalidatePath("/recruiter/openings");
  revalidatePath("/recruiter/dashboard");

  return { success: true };
}

export async function getRecruiterOpenings(): Promise<RecruiterOpening[]> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return [];
  }

  return db
    .select()
    .from(recruiterOpenings)
    .where(eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId))
    .orderBy(recruiterOpenings.createdAt);
}

export async function getOpening(
  openingId: string
): Promise<RecruiterOpening | null> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter) {
    return null;
  }

  const [opening] = await db
    .select()
    .from(recruiterOpenings)
    .where(
      and(
        eq(recruiterOpenings.id, openingId),
        eq(recruiterOpenings.recruiterProfileId, recruiter.recruiterProfileId)
      )
    )
    .limit(1);

  return opening || null;
}
