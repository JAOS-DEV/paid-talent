import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db, workerProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";
import {
  deniedVerifiedRecruiterResponse,
  requireVerifiedRecruiter,
} from "@/lib/recruiter-access";
import {
  createContactRequest,
  listRecruiterSent,
  listWorkerInbox,
} from "@/lib/contact-requests";
import { getMessagingSettings } from "@/lib/messaging/settings";

const createSchema = z.object({
  workerProfileId: z.string().uuid(),
  venueId: z.string().uuid(),
  openerText: z.string().min(1).max(5000),
  openingId: z.string().uuid().nullable().optional(),
});

function errorResponse(result: {
  code: string;
  status: number;
  message: string;
  retryAfter?: Date;
}): NextResponse {
  return NextResponse.json(
    {
      error: result.message,
      code: result.code,
      ...(result.retryAfter
        ? { retryAfter: result.retryAfter.toISOString() }
        : {}),
    },
    { status: result.status }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireVerifiedRecruiter();
    if (!actor.ok) {
      return deniedVerifiedRecruiterResponse(actor);
    }

    const body = await request.json();
    const validation = createSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const result = await createContactRequest({
      recruiterUserId: actor.user.userId,
      workerProfileId: validation.data.workerProfileId,
      venueId: validation.data.venueId,
      openerText: validation.data.openerText,
      openingId: validation.data.openingId,
    });

    if (!result.ok) {
      return errorResponse(result);
    }

    return NextResponse.json({
      success: true,
      request: {
        id: result.request.id,
        status: result.request.status,
        workerProfileId: result.request.workerProfileId,
        venueId: result.request.venueId,
        openingId: result.request.openingId,
        deliveredAt: result.request.deliveredAt,
        expiresAt: result.request.expiresAt,
        createdAt: result.request.createdAt,
      },
      limits: result.limits,
    });
  } catch (error) {
    console.error("[ContactRequests] create failed:", error);
    return NextResponse.json(
      { error: "Failed to create contact request" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({
      role: ["worker", "recruiter"],
    });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const box = request.nextUrl.searchParams.get("box");

    if (box === "inbox") {
      if (actor.user.role !== "worker") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const [profile] = await db
        .select({ id: workerProfiles.id })
        .from(workerProfiles)
        .where(eq(workerProfiles.userId, actor.user.userId))
        .limit(1);

      if (!profile) {
        return NextResponse.json({ requests: [] });
      }

      const requests = await listWorkerInbox(actor.user.userId, profile.id);
      return NextResponse.json({ requests });
    }

    if (box === "sent") {
      if (actor.user.role !== "recruiter") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const verified = await requireVerifiedRecruiter();
      if (!verified.ok) {
        return deniedVerifiedRecruiterResponse(verified);
      }

      const settings = await getMessagingSettings();
      const { requests, limits } = await listRecruiterSent(
        actor.user.userId,
        settings.followUpAfterHours
      );

      return NextResponse.json({ requests, limits });
    }

    return NextResponse.json(
      { error: "Invalid box. Use inbox or sent." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[ContactRequests] list failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact requests" },
      { status: 500 }
    );
  }
}
