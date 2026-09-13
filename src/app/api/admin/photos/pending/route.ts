import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, profilePhotos, workerProfiles, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAdminEmail } from "@/lib/admin";

export interface PendingPhotoItem {
  id: string;
  userId: string;
  workerProfileId: string;
  photoUrl: string;
  moderationReason: string | null;
  moderationConfidence: number | null;
  moderationCategories: string[] | null;
  createdAt: Date;
  worker: {
    displayName: string;
    email: string | null;
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = isAdminEmail(session.user.email);

    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        {
          error: "Forbidden",
          reason: adminCheck.reason,
        },
        { status: 403 }
      );
    }

    const pendingPhotos = await db
      .select({
        id: profilePhotos.id,
        userId: profilePhotos.userId,
        workerProfileId: profilePhotos.workerProfileId,
        photoUrl: profilePhotos.photoUrl,
        moderationReason: profilePhotos.moderationReason,
        moderationConfidence: profilePhotos.moderationConfidence,
        moderationCategories: profilePhotos.moderationCategories,
        createdAt: profilePhotos.createdAt,
        workerDisplayName: workerProfiles.displayName,
        workerEmail: users.email,
      })
      .from(profilePhotos)
      .innerJoin(
        workerProfiles,
        eq(profilePhotos.workerProfileId, workerProfiles.id)
      )
      .innerJoin(users, eq(profilePhotos.userId, users.id))
      .where(eq(profilePhotos.moderationStatus, "pending"))
      .orderBy(profilePhotos.createdAt);

    const result: PendingPhotoItem[] = pendingPhotos.map((photo) => ({
      id: photo.id,
      userId: photo.userId,
      workerProfileId: photo.workerProfileId,
      photoUrl: photo.photoUrl,
      moderationReason: photo.moderationReason,
      moderationConfidence: photo.moderationConfidence,
      moderationCategories: photo.moderationCategories as string[] | null,
      createdAt: photo.createdAt,
      worker: {
        displayName: photo.workerDisplayName,
        email: photo.workerEmail,
      },
    }));

    return NextResponse.json({
      success: true,
      photos: result,
      count: result.length,
    });
  } catch (error) {
    console.error("[Admin Photos Pending] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending photos" },
      { status: 500 }
    );
  }
}
