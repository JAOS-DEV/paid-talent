import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db, workerProfiles, profileInterests, subscriptions } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { isProfileTopTalent, recordProfileView } from "@/lib/ranking";
import {
  canViewContactDetails,
  type SubscriptionInfo,
} from "@/lib/helpers/contact-visibility";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";
import { getApprovedPhotosForWorker } from "@/lib/moderation";

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

    const [profile] = await db
      .select()
      .from(workerProfiles)
      .where(
        and(eq(workerProfiles.id, id), eq(workerProfiles.isPublished, true))
      )
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 404 }
      );
    }

    await recordProfileView(profile.id, session.user.id);

    const isTopTalent = await isProfileTopTalent(profile.id);
    const isOwnProfile = profile.userId === session.user.id;

    const [subscription] = await db
      .select({
        status: subscriptions.status,
        plan: subscriptions.plan,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.user.id))
      .limit(1);

    const contactVisible = canViewContactDetails({
      isOwnProfile,
      isTopTalent,
      subscription: subscription as SubscriptionInfo | null ?? null,
    });

    const [existingInterest] = await db
      .select()
      .from(profileInterests)
      .where(
        and(
          eq(profileInterests.recruiterUserId, session.user.id),
          eq(profileInterests.workerProfileId, profile.id)
        )
      )
      .limit(1);

    const approvedPhotos = await getApprovedPhotosForWorker(profile.id);
    const photos: WorkerPhoto[] = approvedPhotos.map((photo) => ({
      id: photo.id,
      photoUrl: photo.photoUrl,
      displayOrder: photo.displayOrder,
      isCurrentApproved: photo.isCurrentApproved,
    }));

    const result: WorkerProfileDetail = {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      photoUrl: profile.photoUrl,
      photos,
      location: profile.location,
      area: profile.area,
      bio: profile.bio,
      description: profile.description,
      jobRoles: (profile.jobRoles as string[]) ?? [],
      experience: profile.experience,
      experienceYears: profile.experienceYears,
      languages: (profile.languages as string[]) ?? [],
      availability: profile.availability,
      expectedPayMin: profile.expectedPayMin,
      expectedPayMax: profile.expectedPayMax,
      payCurrency: profile.payCurrency,
      isVerified: profile.isVerified,
      isTopTalent,
      contact: {
        isLocked: !contactVisible,
        lineId: contactVisible ? profile.lineId : null,
        whatsappNumber: contactVisible ? profile.whatsappNumber : null,
        phoneNumber: contactVisible ? profile.phoneNumber : null,
      },
      hasExpressedInterest: !!existingInterest,
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
