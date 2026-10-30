import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  contactRequests,
  db,
  hireOutcomes,
  users,
  workerProfiles,
} from "@/lib/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getLatestConfirmationRequestForInterest } from "@/lib/hire-outcomes/queries";
import { isProfileTopTalent, recordProfileView } from "@/lib/ranking";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";
import { getApprovedPhotosForWorker } from "@/lib/moderation";
import { isSearchableWorker } from "@/lib/verification";
import { getRecruiterAccess } from "@/lib/recruiter-access";
import {
  mapApprovedPhotosToPublic,
  resolveWorkerDetailMode,
  toRecruiterWorkerTeaserDto,
  toWorkerProfileDetail,
  type WorkerProfileDetail,
} from "@/lib/recruiter-access/worker-dto";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export type { WorkerProfileDetail };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const access = await getRecruiterAccess(actor.user.userId);
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

    const isTopTalent = await isProfileTopTalent(workerProfile.id);
    const detailMode = resolveWorkerDetailMode(access, isTopTalent);

    if (detailMode !== "full") {
      return NextResponse.json({
        profile: toRecruiterWorkerTeaserDto(workerProfile, isTopTalent),
      });
    }

    await recordProfileView(workerProfile.id, actor.user.userId);

    const [openRequest] = await db
      .select({
        id: contactRequests.id,
        status: contactRequests.status,
        outcomeStatus: hireOutcomes.status,
        hiredAt: hireOutcomes.hiredAt,
        startedAt: hireOutcomes.startedAt,
      })
      .from(contactRequests)
      .leftJoin(
        hireOutcomes,
        eq(contactRequests.id, hireOutcomes.contactRequestId)
      )
      .where(
        and(
          eq(contactRequests.recruiterUserId, actor.user.userId),
          eq(contactRequests.workerProfileId, workerProfile.id),
          inArray(contactRequests.status, ["queued", "pending", "accepted"])
        )
      )
      .orderBy(desc(contactRequests.createdAt))
      .limit(1);

    const confirmationRequest =
      openRequest?.status === "accepted"
        ? await getLatestConfirmationRequestForInterest(openRequest.id)
        : null;

    const approvedPhotos = await getApprovedPhotosForWorker(workerProfile.id);
    const photos = mapApprovedPhotosToPublic(approvedPhotos);

    const result = toWorkerProfileDetail(workerProfile, {
      isTopTalent,
      photos,
      contactRequest: openRequest
        ? { id: openRequest.id, status: openRequest.status }
        : null,
      ...(openRequest?.status === "accepted" && {
        hireOutcomeStatus: openRequest.outcomeStatus ?? "interested",
        hiredAt: openRequest.hiredAt,
        startedAt: openRequest.startedAt,
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
