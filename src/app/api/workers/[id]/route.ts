import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  db,
  workerProfiles,
  profileInterests,
  hireOutcomes,
  users,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getLatestConfirmationRequestForInterest } from "@/lib/hire-outcomes/queries";
import { isProfileTopTalent, recordProfileView } from "@/lib/ranking";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";
import { getApprovedPhotosForWorker } from "@/lib/moderation";
import { isSearchableWorker } from "@/lib/verification";
import {
  mapApprovedPhotosToPublic,
  toWorkerProfileDetail,
  type WorkerProfileDetail,
} from "@/lib/worker-profile/recruiter-dto";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export type { WorkerProfileDetail };

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const { id } = await params;

    const [profile] = await db
      .select({
        profile: workerProfiles,
        accountStatus: users.accountStatus,
      })
      .from(workerProfiles)
      .innerJoin(users, eq(workerProfiles.userId, users.id))
      .where(
        and(eq(workerProfiles.id, id), eq(workerProfiles.isPublished, true))
      )
      .limit(1);

    if (!profile || profile.accountStatus !== "active") {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    const workerProfile = profile.profile;
    const searchability = isSearchableWorker(workerProfile);
    if (!searchability.isSearchable) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    await recordProfileView(workerProfile.id, actor.user.userId);

    const isTopTalent = await isProfileTopTalent(workerProfile.id);

    const [interestWithOutcome] = await db
      .select({
        interestId: profileInterests.id,
        outcomeStatus: hireOutcomes.status,
        hiredAt: hireOutcomes.hiredAt,
        startedAt: hireOutcomes.startedAt,
      })
      .from(profileInterests)
      .leftJoin(hireOutcomes, eq(profileInterests.id, hireOutcomes.interestId))
      .where(
        and(
          eq(profileInterests.recruiterUserId, actor.user.userId),
          eq(profileInterests.workerProfileId, workerProfile.id)
        )
      )
      .limit(1);

    const confirmationRequest = interestWithOutcome
      ? await getLatestConfirmationRequestForInterest(
          interestWithOutcome.interestId
        )
      : null;

    const approvedPhotos = await getApprovedPhotosForWorker(workerProfile.id);
    const photos = mapApprovedPhotosToPublic(approvedPhotos);

    const result = toWorkerProfileDetail(workerProfile, {
      isTopTalent,
      photos,
      hasExpressedInterest: !!interestWithOutcome,
      ...(interestWithOutcome && {
        interestId: interestWithOutcome.interestId,
        hireOutcomeStatus: interestWithOutcome.outcomeStatus ?? "interested",
        hiredAt: interestWithOutcome.hiredAt,
        startedAt: interestWithOutcome.startedAt,
        confirmationRequest: confirmationRequest
          ? {
              id: confirmationRequest.id,
              requestedStatus: confirmationRequest.requestedStatus,
              requestStatus: confirmationRequest.requestStatus,
              requestedAt: confirmationRequest.requestedAt,
            }
          : null,
      }),
    });

    return NextResponse.json({ profile: result });
  } catch (error) {
    console.error("[Worker Profile] Error:", error);

    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }

    return NextResponse.json(
      { error: "Failed to fetch worker profile" },
      { status: 500 }
    );
  }
}
