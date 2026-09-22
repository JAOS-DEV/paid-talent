"use server";

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
import {
  hasLegacyPayRange,
  LEGACY_PAY_RANGE_MESSAGE,
  toOpeningPayStorage,
} from "./opening-pay";
import {
  actionAuthError,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface ActionResultWithData<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getAuthenticatedRecruiter(): Promise<
  | { ok: true; userId: string; recruiterProfileId: string }
  | { ok: false; error: string }
> {
  const result = await requireActiveRecruiter();
  if (!result.ok) {
    return actionAuthError(result);
  }

  const [profile] = await db
    .select({ id: recruiterProfiles.id })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, result.user.userId))
    .limit(1);

  if (!profile) {
    return { ok: false, error: "Unauthorized" };
  }

  return { ok: true, userId: result.user.userId, recruiterProfileId: profile.id };
}

export async function updateRecruiterProfile(
  data: unknown
): Promise<ActionResult> {
  const recruiter = await getAuthenticatedRecruiter();
  if (!recruiter.ok) {
    return { success: false, error: recruiter.error };
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
    contactEmail,
    contactPhone,
  } = validation.data;

  // Venue logos are written only by /api/recruiter/logo. Profile saves must
  // not clear them or accept an arbitrary client-supplied URL.
  await db
    .update(recruiterProfiles)
    .set({
      organizationName,
      area,
      subArea: normalizeOptionalText(subArea),
      blurb,
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
  if (!recruiter.ok) {
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
  if (!recruiter.ok) {
    return { success: false, error: recruiter.error };
  }

  const validation = createOpeningSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const { role, area, payAmount, payCurrency, payPeriod, notes, isPublished } =
    validation.data;
  const payStorage = toOpeningPayStorage(normalizeOptionalPay(payAmount));

  const [opening] = await db
    .insert(recruiterOpenings)
    .values({
      recruiterProfileId: recruiter.recruiterProfileId,
      role,
      area,
      payMin: payStorage.payMin,
      payMax: payStorage.payMax,
      payCurrency,
      payPeriod,
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
  if (!recruiter.ok) {
    return { success: false, error: recruiter.error };
  }

  const validation = updateOpeningSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const { id, role, area, payAmount, payCurrency, payPeriod, notes, isPublished } =
    validation.data;

  const [existingOpening] = await db
    .select({
      id: recruiterOpenings.id,
      payMin: recruiterOpenings.payMin,
      payMax: recruiterOpenings.payMax,
    })
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

  if (hasLegacyPayRange(existingOpening) && payAmount === undefined) {
    return { success: false, error: LEGACY_PAY_RANGE_MESSAGE };
  }

  const payStorage = toOpeningPayStorage(normalizeOptionalPay(payAmount));

  await db
    .update(recruiterOpenings)
    .set({
      role,
      area,
      payMin: payStorage.payMin,
      payMax: payStorage.payMax,
      payCurrency,
      payPeriod,
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
  if (!recruiter.ok) {
    return { success: false, error: recruiter.error };
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
  if (!recruiter.ok) {
    return { success: false, error: recruiter.error };
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
  if (!recruiter.ok) {
    return { success: false, error: recruiter.error };
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
  if (!recruiter.ok) {
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
  if (!recruiter.ok) {
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
