import React from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { listPendingPhotosForAdmin } from "@/lib/admin/pending-data";
import { PhotoQueue } from "@/components/admin/PhotoQueue";
import type { PendingPhoto } from "@/components/admin/PhotoQueue";

function serializePhotos(
  photos: Awaited<ReturnType<typeof listPendingPhotosForAdmin>>["photos"]
): PendingPhoto[] {
  return photos.map((photo) => ({
    ...photo,
    createdAt: photo.createdAt.toISOString(),
  }));
}

export default async function AdminPhotosPage(): Promise<React.ReactElement> {
  const { email } = await requireAdminPage("/admin/photos");
  const { photos } = await listPendingPhotosForAdmin({
    adminEmail: email,
    includeSignedMedia: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">
          Photo moderation
        </h1>
        <p className="text-charcoal-400 mt-1">
          Review quarantined profile photos. Safe and explicit cases are already
          handled automatically by policy.
        </p>
      </div>
      <PhotoQueue initialPhotos={serializePhotos(photos)} />
    </div>
  );
}
