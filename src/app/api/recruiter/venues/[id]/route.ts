import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import { db, recruiterProfiles } from "@/lib/db";
import {
  archiveVenue,
  setPrimary,
  updateVenue,
} from "@/lib/venues/service";

const updateVenueBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  venueType: z.string().trim().max(100).optional().nullable(),
  area: z.string().trim().max(100).optional().nullable(),
  subArea: z.string().trim().max(100).optional().nullable(),
  blurb: z.string().trim().max(240).optional().nullable(),
  venueLinkUrl: z.string().trim().min(1).max(2000),
  isPrimary: z.boolean().optional(),
  setPrimaryOnly: z.boolean().optional(),
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const actor = await requireActiveRecruiter();
  if (!actor.ok) {
    return deniedActiveUserResponse(actor);
  }

  const recruiterProfileId = await getRecruiterProfileId(actor.user.userId);
  if (!recruiterProfileId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { id: venueId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateVenueBodySchema.safeParse(body);
  if (!parsed.success) {
    // Allow set-primary-only payloads
    const setPrimaryOnly = z
      .object({ setPrimaryOnly: z.literal(true) })
      .safeParse(body);
    if (setPrimaryOnly.success) {
      const result = await setPrimary(venueId, recruiterProfileId);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }
      return NextResponse.json({ venue: result.data });
    }

    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  if (parsed.data.setPrimaryOnly) {
    const result = await setPrimary(venueId, recruiterProfileId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    return NextResponse.json({ venue: result.data });
  }

  const result = await updateVenue(venueId, recruiterProfileId, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ venue: result.data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const actor = await requireActiveRecruiter();
  if (!actor.ok) {
    return deniedActiveUserResponse(actor);
  }

  const recruiterProfileId = await getRecruiterProfileId(actor.user.userId);
  if (!recruiterProfileId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { id: venueId } = await params;
  const result = await archiveVenue(venueId, recruiterProfileId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ venue: result.data, archived: true });
}
