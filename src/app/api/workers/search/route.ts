import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db, workerProfiles, users } from "@/lib/db";
import { eq, and, ilike, sql, type SQL } from "drizzle-orm";
import { isProfileTopTalent } from "@/lib/ranking";
import { isSearchableWorker } from "@/lib/verification";
import {
  validateSearchParams,
  buildFilterCriteria,
} from "@/lib/helpers/search-filters";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";

export interface SearchWorkerResult {
  id: string;
  userId: string;
  displayName: string;
  photoUrl: string | null;
  location: string | null;
  area: string | null;
  bio: string | null;
  jobRoles: string[];
  availability: string[];
  experienceYears: number | null;
  languages: string[];
  isVerified: boolean;
  isTopTalent: boolean;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const { searchParams } = new URL(request.url);
    const validation = validateSearchParams({
      query: searchParams.get("query") || searchParams.get("q") || undefined,
      role: searchParams.get("role") || searchParams.get("jobRole") || undefined,
      area: searchParams.get("area") || undefined,
      availability: searchParams.get("availability") || undefined,
      verified: searchParams.get("verified") || undefined,
      limit: searchParams.get("limit") || 20,
      offset: searchParams.get("offset") || 0,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid search parameters", details: validation.errors },
        { status: 400 }
      );
    }

    const { limit, offset } = validation.data!;
    const filters = buildFilterCriteria(validation.data!);

    const conditions: SQL[] = [
      eq(workerProfiles.isPublished, true),
      eq(workerProfiles.verificationStatus, "verified"),
      eq(users.accountStatus, "active"),
      sql`${workerProfiles.photoUrl} IS NOT NULL`,
      sql`${workerProfiles.photoKey} IS NOT NULL`,
    ];

    if (filters.query) {
      conditions.push(
        sql`(${ilike(workerProfiles.displayName, `%${filters.query}%`)} OR ${ilike(workerProfiles.description, `%${filters.query}%`)} OR ${ilike(workerProfiles.bio, `%${filters.query}%`)})`
      );
    }

    if (filters.role) {
      conditions.push(
        sql`${workerProfiles.jobRoles}::jsonb ? ${filters.role}`
      );
    }

    if (filters.area) {
      conditions.push(ilike(workerProfiles.area, `%${filters.area}%`));
    }

    if (filters.availability) {
      conditions.push(
        sql`${workerProfiles.availability}::jsonb ? ${filters.availability}`
      );
    }

    const profiles = await db
      .select({
        profile: workerProfiles,
      })
      .from(workerProfiles)
      .innerJoin(users, eq(workerProfiles.userId, users.id))
      .where(and(...conditions))
      .orderBy(workerProfiles.createdAt)
      .limit(limit)
      .offset(offset);

    const searchableProfiles = profiles
      .map((row) => row.profile)
      .filter((profile) => {
        const result = isSearchableWorker(profile);
        return result.isSearchable;
      });

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workerProfiles)
      .innerJoin(users, eq(workerProfiles.userId, users.id))
      .where(and(...conditions));
    const total = totalResult[0]?.count ?? 0;

    const results: SearchWorkerResult[] = await Promise.all(
      searchableProfiles.map(async (profile) => ({
        id: profile.id,
        userId: profile.userId,
        displayName: profile.displayName,
        photoUrl: profile.photoUrl,
        location: profile.location,
        area: profile.area,
        bio: profile.bio,
        jobRoles: (profile.jobRoles as string[]) ?? [],
        availability: profile.availability ?? [],
        experienceYears: profile.experienceYears,
        languages: (profile.languages as string[]) ?? [],
        isVerified: profile.verificationStatus === "verified",
        isTopTalent: await isProfileTopTalent(profile.id),
      }))
    );

    return NextResponse.json({
      workers: results,
      total: searchableProfiles.length,
      hasMore: offset + results.length < total,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + results.length < total,
      },
    });
  } catch (error) {
    console.error("[Workers Search] Error:", error);

    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }

    return NextResponse.json(
      { error: "Failed to search workers" },
      { status: 500 }
    );
  }
}
