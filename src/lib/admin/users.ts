import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  adminEntitlements,
  profilePhotos,
  recruiterOpenings,
  recruiterProfiles,
  subscriptions,
  users,
  workerProfiles,
  type AccountStatus,
} from "@/lib/db/schema";
import { isAppUserId } from "@/lib/auth/pending-signup";
import { getEffectiveEntitlement } from "@/lib/entitlements";
import { getProfileCompleteness } from "@/lib/profile";

export const ADMIN_USERS_PAGE_SIZE = 20;

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: "worker" | "recruiter";
  createdAt: string;
  ageVerified: boolean;
  accountStatus: AccountStatus;
  premiumSummary: string;
}

export async function searchAdminUsers(input: {
  query?: string;
  page?: number;
}): Promise<{
  users: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, input.page ?? 1);
  const query = input.query?.trim() ?? "";
  const offset = (page - 1) * ADMIN_USERS_PAGE_SIZE;

  const conditions = [];
  if (query) {
    const like = `%${query}%`;
    const matches = [
      ilike(users.email, like),
      ilike(users.name, like),
    ];
    if (isAppUserId(query)) {
      matches.push(eq(users.id, query));
    }
    conditions.push(or(...matches));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const filteredList = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      ageVerified: users.ageVerified,
      accountStatus: users.accountStatus,
      subscriptionPlan: subscriptions.plan,
      subscriptionStatus: subscriptions.status,
      grantIsLifetime: adminEntitlements.isLifetime,
      grantExpiresAt: adminEntitlements.expiresAt,
      grantRevokedAt: adminEntitlements.revokedAt,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .leftJoin(
      adminEntitlements,
      and(
        eq(adminEntitlements.userId, users.id),
        isNull(adminEntitlements.revokedAt)
      )
    );

  const listQuery = (
    where ? filteredList.where(where) : filteredList
  )
    .orderBy(desc(users.createdAt))
    .limit(ADMIN_USERS_PAGE_SIZE)
    .offset(offset);

  const countQuery = where
    ? db.select({ value: count() }).from(users).where(where)
    : db.select({ value: count() }).from(users);

  const [rows, totalRows] = await Promise.all([listQuery, countQuery]);

  const now = new Date();
  const items: AdminUserListItem[] = rows.map((row) => {
    const paid =
      row.subscriptionPlan === "top_talent_unlock" &&
      (row.subscriptionStatus === "active" ||
        row.subscriptionStatus === "trialing");
    const grantActive =
      row.grantRevokedAt == null &&
      (row.grantIsLifetime === true ||
        (row.grantExpiresAt != null && row.grantExpiresAt > now));

    let premiumSummary = "None";
    if (paid && grantActive && row.grantIsLifetime) {
      premiumSummary = "Paid + lifetime admin";
    } else if (paid && grantActive) {
      premiumSummary = "Paid + admin grant";
    } else if (paid) {
      premiumSummary = "Paid";
    } else if (grantActive && row.grantIsLifetime) {
      premiumSummary = "Lifetime admin";
    } else if (grantActive) {
      premiumSummary = "Admin grant";
    }

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      ageVerified: row.ageVerified,
      accountStatus: row.accountStatus,
      premiumSummary,
    };
  });

  return {
    users: items,
    total: totalRows[0]?.value ?? 0,
    page,
    pageSize: ADMIN_USERS_PAGE_SIZE,
  };
}

export async function getAdminUserDetail(userId: string): Promise<{
  user: {
    id: string;
    email: string;
    name: string | null;
    role: "worker" | "recruiter";
    createdAt: string;
    updatedAt: string;
    ageVerified: boolean;
    accountStatus: AccountStatus;
    accountStatusReason: string | null;
    accountStatusChangedAt: string | null;
    accountStatusChangedBy: string | null;
  };
  worker: {
    publicationStatus: boolean;
    identityVerificationStatus: string;
    isVerified: boolean;
    photoCounts: {
      pending: number;
      approved: number;
      rejected: number;
    };
    completenessPercent: number;
    displayName: string;
    createdAt: string;
  } | null;
  recruiter: {
    organizationName: string | null;
    organizationType: string | null;
    location: string | null;
    area: string | null;
    openingCount: number;
    publishedOpeningCount: number;
  } | null;
  entitlement: Awaited<ReturnType<typeof getEffectiveEntitlement>>;
} | null> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      ageVerified: users.ageVerified,
      accountStatus: users.accountStatus,
      accountStatusReason: users.accountStatusReason,
      accountStatusChangedAt: users.accountStatusChangedAt,
      accountStatusChangedBy: users.accountStatusChangedBy,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  const entitlement = await getEffectiveEntitlement(user.id);

  let worker = null;
  if (user.role === "worker") {
    const [profile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, user.id))
      .limit(1);

    if (profile) {
      const photoRows = await db
        .select({
          status: profilePhotos.moderationStatus,
          value: count(),
        })
        .from(profilePhotos)
        .where(eq(profilePhotos.userId, user.id))
        .groupBy(profilePhotos.moderationStatus);

      const photoCounts = { pending: 0, approved: 0, rejected: 0 };
      for (const row of photoRows) {
        if (row.status === "pending") photoCounts.pending = row.value;
        if (row.status === "approved") photoCounts.approved = row.value;
        if (row.status === "rejected") photoCounts.rejected = row.value;
      }

      worker = {
        publicationStatus: profile.isPublished,
        identityVerificationStatus: profile.verificationStatus,
        isVerified: profile.isVerified,
        photoCounts,
        completenessPercent: getProfileCompleteness(profile).progress,
        displayName: profile.displayName,
        createdAt: profile.createdAt.toISOString(),
      };
    }
  }

  let recruiter = null;
  if (user.role === "recruiter") {
    const [profile] = await db
      .select()
      .from(recruiterProfiles)
      .where(eq(recruiterProfiles.userId, user.id))
      .limit(1);

    if (profile) {
      const [openingCounts] = await db
        .select({
          total: count(),
          published: sql<number>`count(*) filter (where ${recruiterOpenings.isPublished} = true)::int`,
        })
        .from(recruiterOpenings)
        .where(eq(recruiterOpenings.recruiterProfileId, profile.id));

      recruiter = {
        organizationName: profile.organizationName,
        organizationType: profile.organizationType,
        location: profile.location,
        area: profile.area,
        openingCount: openingCounts?.total ?? 0,
        publishedOpeningCount: Number(openingCounts?.published ?? 0),
      };
    }
  }

  return {
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      accountStatusChangedAt: user.accountStatusChangedAt
        ? user.accountStatusChangedAt.toISOString()
        : null,
    },
    worker,
    recruiter,
    entitlement,
  };
}
