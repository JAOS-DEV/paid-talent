import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db, workerProfiles } from "@/lib/db";
import { eq, and, ilike, sql, type SQL } from "drizzle-orm";
import { isProfileTopTalent } from "@/lib/ranking";
import {
  validateSearchParams,
  buildFilterCriteria,
} from "@/lib/helpers/search-filters";

export interface SearchWorkerResult {
  id: string;
  userId: string;
  displayName: string;
  photoUrl: string | null;
  location: string | null;
  area: string | null;
  jobRoles: string[];
  availability: string | null;
  isVerified: boolean;
  isTopTalent: boolean;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "recruiter") {
      return NextResponse.json(
        { error: "Only recruiters can search workers" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const validation = validateSearchParams({
      query: searchParams.get("query") || undefined,
      role: searchParams.get("role") || undefined,
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

    const conditions: SQL[] = [eq(workerProfiles.isPublished, true)];

    if (filters.query) {
      conditions.push(
        sql`(${ilike(workerProfiles.displayName, `%${filters.query}%`)} OR ${ilike(workerProfiles.description, `%${filters.query}%`)})`
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
      conditions.push(ilike(workerProfiles.availability, `%${filters.availability}%`));
    }

    if (filters.verifiedOnly) {
      conditions.push(eq(workerProfiles.isVerified, true));
    }

    const profiles = await db
      .select({
        id: workerProfiles.id,
        userId: workerProfiles.userId,
        displayName: workerProfiles.displayName,
        photoUrl: workerProfiles.photoUrl,
        location: workerProfiles.location,
        area: workerProfiles.area,
        jobRoles: workerProfiles.jobRoles,
        availability: workerProfiles.availability,
        isVerified: workerProfiles.isVerified,
      })
      .from(workerProfiles)
      .where(and(...conditions))
      .orderBy(workerProfiles.createdAt)
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workerProfiles)
      .where(and(...conditions));
    const total = totalResult[0]?.count ?? 0;

    const results: SearchWorkerResult[] = await Promise.all(
      profiles.map(async (profile) => ({
        ...profile,
        jobRoles: (profile.jobRoles as string[]) ?? [],
        isTopTalent: await isProfileTopTalent(profile.id),
      }))
    );

    return NextResponse.json({
      workers: results,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + profiles.length < total,
      },
    });
  } catch (error) {
    console.error("[Workers Search] Error:", error);
    return NextResponse.json(
      { error: "Failed to search workers" },
      { status: 500 }
    );
  }
}
