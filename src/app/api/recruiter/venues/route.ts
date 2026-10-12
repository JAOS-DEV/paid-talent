import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import { db, recruiterProfiles } from "@/lib/db";
import {
  createVenue,
  getMaxVenues,
  listVenues,
} from "@/lib/venues/service";

const createVenueBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  venueType: z.string().trim().max(100).optional().nullable(),
  area: z.string().trim().max(100).optional().nullable(),
  subArea: z.string().trim().max(100).optional().nullable(),
  blurb: z.string().trim().max(240).optional().nullable(),
  venueLinkUrl: z.string().trim().min(1).max(2000),
  isPrimary: z.boolean().optional(),
});

async function getRecruiterProfileId(
  userId: string
): Promise<string | null> {
  const [profile] = await db
    .select({ id: recruiterProfiles.id })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, userId))
    .limit(1);
  return profile?.id ?? null;
}

export async function GET(): Promise<NextResponse> {
  const actor = await requireActiveRecruiter();
  if (!actor.ok) {
    return deniedActiveUserResponse(actor);
  }

  const recruiterProfileId = await getRecruiterProfileId(actor.user.userId);
  if (!recruiterProfileId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const [venuesList, maxVenues] = await Promise.all([
    listVenues(recruiterProfileId),
    getMaxVenues(actor.user.userId),
  ]);

  return NextResponse.json({
    venues: venuesList,
    maxVenues,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const actor = await requireActiveRecruiter();
  if (!actor.ok) {
    return deniedActiveUserResponse(actor);
  }

  const recruiterProfileId = await getRecruiterProfileId(actor.user.userId);
  if (!recruiterProfileId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createVenueBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const result = await createVenue(recruiterProfileId, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ venue: result.data }, { status: 201 });
}
