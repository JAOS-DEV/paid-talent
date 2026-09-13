import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, workerProfiles, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAdminEmail } from "@/lib/admin";
import {
  getSignedIdDocumentUrl,
  getSignedLivenessVideoUrl,
} from "@/lib/storage/s3";
import { formatChallengeCodeForDisplay } from "@/lib/verification";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";

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

    const pendingWorkers = await db
      .select({
        id: workerProfiles.id,
        userId: workerProfiles.userId,
        displayName: workerProfiles.displayName,
        email: users.email,
        location: workerProfiles.location,
        area: workerProfiles.area,
        verificationStatus: workerProfiles.verificationStatus,
        idDocumentKey: workerProfiles.idDocumentKey,
        livenessVideoKey: workerProfiles.livenessVideoKey,
        challengeCode: workerProfiles.challengeCode,
        challengeIssuedAt: workerProfiles.challengeIssuedAt,
        idDocumentSubmittedAt: workerProfiles.idDocumentSubmittedAt,
        createdAt: workerProfiles.createdAt,
      })
      .from(workerProfiles)
      .innerJoin(users, eq(workerProfiles.userId, users.id))
      .where(eq(workerProfiles.verificationStatus, "pending"))
      .orderBy(workerProfiles.idDocumentSubmittedAt);

    const workersWithUrls = await Promise.all(
      pendingWorkers.map(async (worker) => {
        let idDocumentUrl: string | null = null;
        let livenessVideoUrl: string | null = null;

        if (worker.idDocumentKey) {
          try {
            idDocumentUrl = await getSignedIdDocumentUrl(
              worker.idDocumentKey,
              900
            );
          } catch {
            console.warn(
              `[Admin Pending] Could not generate URL for ID document: ${worker.idDocumentKey}`
            );
          }
        }

        if (worker.livenessVideoKey) {
          try {
            livenessVideoUrl = await getSignedLivenessVideoUrl(
              worker.livenessVideoKey,
              900
            );
          } catch {
            console.warn(
              `[Admin Pending] Could not generate URL for liveness video: ${worker.livenessVideoKey}`
            );
          }
        }

        return {
          id: worker.id,
          userId: worker.userId,
          displayName: worker.displayName,
          email: worker.email,
          location: worker.location,
          area: worker.area,
          verificationStatus: worker.verificationStatus,
          idDocumentSubmittedAt: worker.idDocumentSubmittedAt,
          createdAt: worker.createdAt,
          hasIdDocument: !!worker.idDocumentKey,
          hasLivenessVideo: !!worker.livenessVideoKey,
          hasChallengeCode: !!worker.challengeCode,
          challengeCode: worker.challengeCode,
          challengeCodeDisplay: worker.challengeCode
            ? formatChallengeCodeForDisplay(worker.challengeCode)
            : null,
          challengeIssuedAt: worker.challengeIssuedAt,
          idDocumentUrl,
          livenessVideoUrl,
          canApprove:
            !!worker.idDocumentKey &&
            !!worker.livenessVideoKey &&
            !!worker.challengeCode,
        };
      })
    );

    return NextResponse.json({
      success: true,
      workers: workersWithUrls,
      count: workersWithUrls.length,
    });
  } catch (error) {
    console.error("[Admin Workers Pending] Error:", error);

    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }

    return NextResponse.json(
      { error: "Failed to fetch pending workers" },
      { status: 500 }
    );
  }
}
