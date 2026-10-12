import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import sharp from "sharp";
import { and, eq } from "drizzle-orm";
import {
  deniedActiveUserResponse,
  requireActiveRecruiter,
} from "@/lib/auth/require-active-user";
import { db, profilePhotos, users, workerProfiles } from "@/lib/db";
import { formatSchemaErrorResponse } from "@/lib/helpers/db-errors";
import { getPublicMediaObjectBuffer } from "@/lib/storage/s3";
import { isSearchableWorker } from "@/lib/verification";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const TEASER_CACHE_MAX = 200;
const teaserPhotoCache = new Map<string, Buffer>();

function getCachedTeaser(photoKey: string): Buffer | undefined {
  const cached = teaserPhotoCache.get(photoKey);
  if (!cached) return undefined;
  teaserPhotoCache.delete(photoKey);
  teaserPhotoCache.set(photoKey, cached);
  return cached;
}

function setCachedTeaser(photoKey: string, buffer: Buffer): void {
  if (teaserPhotoCache.has(photoKey)) {
    teaserPhotoCache.delete(photoKey);
  }
  teaserPhotoCache.set(photoKey, buffer);
  while (teaserPhotoCache.size > TEASER_CACHE_MAX) {
    const oldest = teaserPhotoCache.keys().next().value;
    if (oldest === undefined) break;
    teaserPhotoCache.delete(oldest);
  }
}

/** Test helper — clears the in-memory teaser LRU. */
export function clearTeaserPhotoCacheForTests(): void {
  teaserPhotoCache.clear();
}

async function resolveApprovedPhotoKey(
  workerProfileId: string,
  profilePhotoKey: string | null
): Promise<string | null> {
  const [currentApproved] = await db
    .select({ photoKey: profilePhotos.photoKey })
    .from(profilePhotos)
    .where(
      and(
        eq(profilePhotos.workerProfileId, workerProfileId),
        eq(profilePhotos.moderationStatus, "approved"),
        eq(profilePhotos.isCurrentApproved, true)
      )
    )
    .limit(1);

  if (currentApproved?.photoKey) {
    return currentApproved.photoKey;
  }

  return profilePhotoKey;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await requireActiveRecruiter();
    if (!actor.ok) {
      return deniedActiveUserResponse(actor);
    }

    const { id } = await params;

    const [row] = await db
      .select({
        profile: workerProfiles,
        accountStatus: users.accountStatus,
      })
      .from(workerProfiles)
      .innerJoin(users, eq(workerProfiles.userId, users.id))
      .where(eq(workerProfiles.id, id))
      .limit(1);

    if (!row || row.accountStatus !== "active") {
      return new NextResponse(null, { status: 404 });
    }

    const searchability = isSearchableWorker(row.profile);
    if (!searchability.isSearchable) {
      return new NextResponse(null, { status: 404 });
    }

    const photoKey = await resolveApprovedPhotoKey(
      row.profile.id,
      row.profile.photoKey
    );

    if (!photoKey) {
      return new NextResponse(null, { status: 404 });
    }

    let webp = getCachedTeaser(photoKey);
    if (!webp) {
      const source = await getPublicMediaObjectBuffer(photoKey);
      webp = await sharp(source)
        .rotate()
        .resize(48, 48, { fit: "cover" })
        .blur(6)
        .webp({ quality: 40 })
        .toBuffer();
      setCachedTeaser(photoKey, webp);
    }

    return new NextResponse(new Uint8Array(webp), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[Teaser Photo] Error:", error);

    const schemaError = formatSchemaErrorResponse(error);
    if (schemaError) {
      return NextResponse.json(schemaError, { status: 503 });
    }

    return new NextResponse(null, { status: 404 });
  }
}
