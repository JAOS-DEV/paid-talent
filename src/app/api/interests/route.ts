import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  db,
  profileInterests,
  workerProfiles,
  users,
  recruiterProfiles,
  recruiterOpenings,
} from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import {
  resolveOpeningContext,
  resolveVenueName,
} from "@/lib/hire-outcomes/confirmations";
import {
  formatOpeningPay,
  joinOpeningContextAndPay,
} from "@/lib/recruiter-profile/opening-pay";
import { toPublicVenueLogoUrl } from "@/lib/media/venue-logo";
import {
  deniedActiveUserResponse,
  requireActiveAppUser,
} from "@/lib/auth/require-active-user";

export async function POST(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "Replaced by contact requests",
      replacement: "/api/contact-requests",
    },
    { status: 410 }
  );
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireActiveAppUser({
      role: ["worker", "recruiter"],
    });
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    if (actor.user.role === "recruiter") {
      const interests = await db
        .select({
          id: profileInterests.id,
          workerProfileId: profileInterests.workerProfileId,
          workerName: workerProfiles.displayName,
          workerPhoto: workerProfiles.photoUrl,
          message: profileInterests.message,
          openingId: profileInterests.openingId,
          createdAt: profileInterests.createdAt,
        })
        .from(profileInterests)
        .innerJoin(
          workerProfiles,
          eq(profileInterests.workerProfileId, workerProfiles.id)
        )
        .where(eq(profileInterests.recruiterUserId, actor.user.userId))
        .orderBy(profileInterests.createdAt);

      return NextResponse.json({ interests });
    }

    const [profile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, actor.user.userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ interests: [] });
    }

    const interests = await db
      .select({
        id: profileInterests.id,
        venueNameOrg: recruiterProfiles.organizationName,
        logoUrl: recruiterProfiles.logoUrl,
        recruiterName: users.name,
        message: profileInterests.message,
        openingRole: recruiterOpenings.role,
        openingArea: recruiterOpenings.area,
        payMin: recruiterOpenings.payMin,
        payMax: recruiterOpenings.payMax,
        payCurrency: recruiterOpenings.payCurrency,
        payPeriod: recruiterOpenings.payPeriod,
        notifiedAt: profileInterests.notifiedAt,
        createdAt: profileInterests.createdAt,
      })
      .from(profileInterests)
      .innerJoin(users, eq(profileInterests.recruiterUserId, users.id))
      .leftJoin(
        recruiterProfiles,
        eq(recruiterProfiles.userId, profileInterests.recruiterUserId)
      )
      .leftJoin(
        recruiterOpenings,
        eq(profileInterests.openingId, recruiterOpenings.id)
      )
      .where(eq(profileInterests.workerProfileId, profile.id))
      .orderBy(desc(profileInterests.createdAt));

    return NextResponse.json({
      interests: interests.map((interest) => ({
        id: interest.id,
        venueName: resolveVenueName(
          interest.venueNameOrg,
          interest.recruiterName
        ),
        logoUrl: toPublicVenueLogoUrl(interest.logoUrl),
        openingContext: joinOpeningContextAndPay(
          resolveOpeningContext(interest.openingRole, interest.openingArea),
          formatOpeningPay({
            payMin: interest.payMin,
            payMax: interest.payMax,
            payCurrency: interest.payCurrency,
            payPeriod: interest.payPeriod,
          })
        ),
        message: interest.message,
        notifiedAt: interest.notifiedAt,
        createdAt: interest.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Interest] Error fetching interests:", error);
    return NextResponse.json(
      { error: "Failed to fetch interests" },
      { status: 500 }
    );
  }
}
