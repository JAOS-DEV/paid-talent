import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  db,
  workerProfiles,
  profileInterests,
  hireOutcomes,
  users,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getLatestConfirmationRequestForInterest } from "@/lib/hire-outcomes/queries";
import type { HireConfirmationRequestedStatus, HireConfirmationRequestStatus } from "@/lib/db/schema";
import { isProfileTopTalent, recordProfileView } from "@/lib/ranking";
import {
  canViewContactDetails,
} from "@/lib/helpers/contact-visibility";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";
import { getApprovedPhotosForWorker } from "@/lib/moderation";
import type { HireOutcomeStatus } from "@/lib/db/schema";
import { getEffectiveEntitlement } from "@/lib/entitlements";
import { getUserAccountAccess } from "@/lib/auth/account-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export interface WorkerPhoto {
  id: string;
  photoUrl: string;
  displayOrder: number;
  isCurrentApproved: boolean;
}

export interface WorkerProfileDetail {
  id: string;
  userId: string;
  displayName: string;
  photoUrl: string | null;
  photos: WorkerPhoto[];
  location: string | null;
  area: string | null;
  bio: string | null;
  description: string | null;
  jobRoles: string[];
  experience: string | null;
  experienceYears: number | null;
  languages: string[];
  availability: string | null;
  expectedPayMin: number | null;
  expectedPayMax: number | null;
  payCurrency: string | null;
  isVerified: boolean;
  isTopTalent: boolean;
  contact: {
    isLocked: boolean;
    lineId: string | null;
    whatsappNumber: string | null;
    phoneNumber: string | null;
  };
  hasExpressedInterest: boolean;
  interestId?: string;
  hireOutcomeStatus?: HireOutcomeStatus;
  hiredAt?: string | null;
  startedAt?: string | null;
  confirmationRequest?: {
    id: string;
    requestedStatus: HireConfirmationRequestedStatus;
    requestStatus: HireConfirmationRequestStatus;
    requestedAt: string;
  } | null;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "recruiter") {
      return NextResponse.json(
        { error: "Only recruiters can view worker profiles" },
        { status: 403 }
      );
    }

    const viewerAccess = await getUserAccountAccess(session.user.id);
    if (!viewerAccess.allowed) {
      return NextResponse.json(
        { error: "Account restricted", reason: viewerAccess.reason },
        { status: 403 }
      );
    }

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

    await recordProfileView(workerProfile.id, session.user.id);

    const isTopTalent = await isProfileTopTalent(workerProfile.id);
    const isOwnProfile = workerProfile.userId === session.user.id;
    const entitlement = await getEffectiveEntitlement(session.user.id);

    const contactVisible = canViewContactDetails({
      isOwnProfile,
      isTopTalent,
      subscription: entitlement.paidSubscription,
      hasPremiumAccess: entitlement.hasPremiumAccess,
    });

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
          eq(profileInterests.recruiterUserId, session.user.id),
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
    const photos: WorkerPhoto[] = approvedPhotos.flatMap((photo) => {
      if (!photo.photoUrl) {
        return [];
      }
      return [
        {
          id: photo.id,
          photoUrl: photo.photoUrl,
          displayOrder: photo.displayOrder,
          isCurrentApproved: photo.isCurrentApproved,
        },
      ];
    });

    const result: WorkerProfileDetail = {
      id: workerProfile.id,
      userId: workerProfile.userId,
      displayName: workerProfile.displayName,
      photoUrl: workerProfile.photoUrl,
      photos,
      location: workerProfile.location,
      area: workerProfile.area,
      bio: workerProfile.bio,
      description: workerProfile.description,
      jobRoles: (workerProfile.jobRoles as string[]) ?? [],
      experience: workerProfile.experience,
      experienceYears: workerProfile.experienceYears,
      languages: (workerProfile.languages as string[]) ?? [],
      availability: workerProfile.availability,
      expectedPayMin: workerProfile.expectedPayMin,
      expectedPayMax: workerProfile.expectedPayMax,
      payCurrency: workerProfile.payCurrency,
      isVerified: workerProfile.isVerified,
      isTopTalent,
      contact: {
        isLocked: !contactVisible,
        lineId: contactVisible ? workerProfile.lineId : null,
        whatsappNumber: contactVisible ? workerProfile.whatsappNumber : null,
        phoneNumber: contactVisible ? workerProfile.phoneNumber : null,
      },
      hasExpressedInterest: !!interestWithOutcome,
      ...(interestWithOutcome && {
        interestId: interestWithOutcome.interestId,
        hireOutcomeStatus: interestWithOutcome.outcomeStatus ?? "interested",
        hiredAt: interestWithOutcome.hiredAt?.toISOString() ?? null,
        startedAt: interestWithOutcome.startedAt?.toISOString() ?? null,
        confirmationRequest: confirmationRequest
          ? {
              id: confirmationRequest.id,
              requestedStatus: confirmationRequest.requestedStatus,
              requestStatus: confirmationRequest.requestStatus,
              requestedAt: confirmationRequest.requestedAt.toISOString(),
            }
          : null,
      }),
    };

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
