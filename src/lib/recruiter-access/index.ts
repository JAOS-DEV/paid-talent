import { and, eq, isNull } from "drizzle-orm";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
  type ActiveAppUser,
  type RequireActiveUserFailure,
  type RequireActiveUserResult,
} from "@/lib/auth/require-active-user";
import { db, recruiterProfiles, users, venues } from "@/lib/db";
import type {
  AccountStatus,
  BillingAccessMode,
  VerificationStatus,
} from "@/lib/db/schema";
import {
  getEffectiveEntitlement,
  type EffectiveEntitlement,
} from "@/lib/entitlements";
import { NextResponse } from "next/server";

export type RecruiterAccessTier = "unverified" | "free" | "pro";

export interface RecruiterAccess {
  userId: string;
  recruiterProfileId: string | null;
  identityStatus: VerificationStatus;
  hasApprovedVenue: boolean;
  approvedVenueIds: string[];
  primaryVenueId: string | null;
  isVerified: boolean;
  tier: RecruiterAccessTier;
  verifiedAt: Date | null;
  /** Reserved for a later safety PR (`messaging_paused_at`). Always false for now. */
  isPaused: boolean;
  canBrowseFull: boolean;
  canViewTopTalentFull: boolean;
  billingAccessMode: BillingAccessMode;
}

/** JSON-safe DTO for GET /api/recruiter/access (no other-user ids). */
export interface RecruiterAccessDto {
  userId: string;
  recruiterProfileId: string | null;
  identityStatus: VerificationStatus;
  hasApprovedVenue: boolean;
  approvedVenueIds: string[];
  primaryVenueId: string | null;
  isVerified: boolean;
  tier: RecruiterAccessTier;
  verifiedAt: string | null;
  isPaused: boolean;
  canBrowseFull: boolean;
  canViewTopTalentFull: boolean;
  billingAccessMode: BillingAccessMode;
}

export interface ResolveRecruiterAccessInput {
  userId: string;
  accountStatus: AccountStatus;
  recruiterProfileId: string | null;
  identityStatus: VerificationStatus;
  verifiedAt: Date | null;
  venues: Array<{
    id: string;
    reviewStatus: "pending" | "approved" | "rejected";
    archivedAt: Date | null;
    isPrimary: boolean;
  }>;
  entitlement: Pick<
    EffectiveEntitlement,
    "paidAccess" | "adminGrantAccess" | "passAccess" | "billingAccessMode"
  >;
}

export function resolveRecruiterAccess(
  input: ResolveRecruiterAccessInput
): RecruiterAccess {
  const approvedVenues = input.venues.filter(
    (venue) => venue.reviewStatus === "approved" && venue.archivedAt == null
  );
  const approvedVenueIds = approvedVenues.map((venue) => venue.id);
  const hasApprovedVenue = approvedVenueIds.length > 0;
  const primaryApproved =
    approvedVenues.find((venue) => venue.isPrimary) ?? approvedVenues[0] ?? null;

  const identityVerified = input.identityStatus === "verified";
  const accountActive = input.accountStatus === "active";
  const isVerified =
    identityVerified && hasApprovedVenue && accountActive && input.recruiterProfileId != null;

  let tier: RecruiterAccessTier = "unverified";
  if (isVerified) {
    const isPro =
      input.entitlement.paidAccess ||
      input.entitlement.adminGrantAccess ||
      input.entitlement.passAccess;
    tier = isPro ? "pro" : "free";
  }

  const canBrowseFull = isVerified;
  const canViewTopTalentFull =
    tier === "pro" ||
    (isVerified && input.entitlement.billingAccessMode === "open_access");

  return {
    userId: input.userId,
    recruiterProfileId: input.recruiterProfileId,
    identityStatus: input.identityStatus,
    hasApprovedVenue,
    approvedVenueIds,
    primaryVenueId: primaryApproved?.id ?? null,
    isVerified,
    tier,
    verifiedAt: isVerified ? input.verifiedAt : null,
    isPaused: false,
    canBrowseFull,
    canViewTopTalentFull,
    billingAccessMode: input.entitlement.billingAccessMode,
  };
}

export function toRecruiterAccessDto(access: RecruiterAccess): RecruiterAccessDto {
  return {
    userId: access.userId,
    recruiterProfileId: access.recruiterProfileId,
    identityStatus: access.identityStatus,
    hasApprovedVenue: access.hasApprovedVenue,
    approvedVenueIds: access.approvedVenueIds,
    primaryVenueId: access.primaryVenueId,
    isVerified: access.isVerified,
    tier: access.tier,
    verifiedAt: access.verifiedAt ? access.verifiedAt.toISOString() : null,
    isPaused: access.isPaused,
    canBrowseFull: access.canBrowseFull,
    canViewTopTalentFull: access.canViewTopTalentFull,
    billingAccessMode: access.billingAccessMode,
  };
}

export async function getRecruiterAccess(
  userId: string
): Promise<RecruiterAccess> {
  const [rows, entitlement] = await Promise.all([
    db
      .select({
        accountStatus: users.accountStatus,
        recruiterProfileId: recruiterProfiles.id,
        identityStatus: recruiterProfiles.verificationStatus,
        verifiedAt: recruiterProfiles.verifiedAt,
        venueId: venues.id,
        venueReviewStatus: venues.reviewStatus,
        venueArchivedAt: venues.archivedAt,
        venueIsPrimary: venues.isPrimary,
      })
      .from(users)
      .leftJoin(recruiterProfiles, eq(recruiterProfiles.userId, users.id))
      .leftJoin(
        venues,
        and(
          eq(venues.recruiterProfileId, recruiterProfiles.id),
          isNull(venues.archivedAt)
        )
      )
      .where(eq(users.id, userId)),
    getEffectiveEntitlement(userId),
  ]);

  const first = rows[0];
  if (!first) {
    return resolveRecruiterAccess({
      userId,
      accountStatus: "active",
      recruiterProfileId: null,
      identityStatus: "unverified",
      verifiedAt: null,
      venues: [],
      entitlement,
    });
  }

  const venueMap = new Map<
    string,
    {
      id: string;
      reviewStatus: "pending" | "approved" | "rejected";
      archivedAt: Date | null;
      isPrimary: boolean;
    }
  >();

  for (const row of rows) {
    if (row.venueId && row.venueReviewStatus) {
      venueMap.set(row.venueId, {
        id: row.venueId,
        reviewStatus: row.venueReviewStatus,
        archivedAt: row.venueArchivedAt,
        isPrimary: row.venueIsPrimary === true,
      });
    }
  }

  return resolveRecruiterAccess({
    userId,
    accountStatus: first.accountStatus,
    recruiterProfileId: first.recruiterProfileId,
    identityStatus: first.identityStatus ?? "unverified",
    verifiedAt: first.verifiedAt,
    venues: Array.from(venueMap.values()),
    entitlement,
  });
}

export type RequireVerifiedRecruiterFailure =
  | RequireActiveUserFailure
  | {
      ok: false;
      status: 403;
      error: string;
      reason: "recruiter_not_verified";
    };

export type RequireVerifiedRecruiterResult =
  | { ok: true; user: ActiveAppUser; access: RecruiterAccess }
  | RequireVerifiedRecruiterFailure;

export async function requireVerifiedRecruiter(): Promise<RequireVerifiedRecruiterResult> {
  const actor = await requireActiveRecruiter();
  if (!actor.ok) {
    return actor;
  }

  const access = await getRecruiterAccess(actor.user.userId);
  if (!access.isVerified) {
    return {
      ok: false,
      status: 403,
      error: "Recruiter not verified",
      reason: "recruiter_not_verified",
    };
  }

  return { ok: true, user: actor.user, access };
}

export function deniedVerifiedRecruiterResponse(
  result: RequireVerifiedRecruiterFailure
): NextResponse {
  if (result.reason === "recruiter_not_verified") {
    return NextResponse.json(
      { error: result.error, reason: result.reason },
      { status: result.status }
    );
  }
  return deniedActiveUserResponse(result);
}

export type { RequireActiveUserResult };
