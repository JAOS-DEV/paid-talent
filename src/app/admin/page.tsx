import React from "react";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { listPendingWorkersForAdmin, listPendingPhotosForAdmin } from "@/lib/admin/pending-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function AdminDashboardPage(): Promise<React.ReactElement> {
  await requireAdminPage("/admin");
  const [verifications, photos] = await Promise.all([
    listPendingWorkersForAdmin(),
    listPendingPhotosForAdmin(),
  ]);
  const counts = {
    verifications: verifications.count,
    photos: photos.count,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Admin overview</h1>
        <p className="text-charcoal-400 mt-1">
          Review worker identity submissions and quarantined profile photos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/verifications" className="block group">
          <Card padding="lg" className="h-full transition-colors group-hover:border-primary-600/40">
            <CardHeader>
              <CardTitle>Identity verification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-primary-300">
                {counts.verifications}
              </p>
              <p className="text-sm text-charcoal-400 mt-2">
                Pending worker identity reviews
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/photos" className="block group">
          <Card padding="lg" className="h-full transition-colors group-hover:border-primary-600/40">
            <CardHeader>
              <CardTitle>Photo moderation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-primary-300">
                {counts.photos}
              </p>
              <p className="text-sm text-charcoal-400 mt-2">
                Quarantined photos awaiting review
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
