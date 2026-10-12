import React from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { listPendingVenuesForAdmin } from "@/lib/venues/review";
import {
  VenueQueue,
  type PendingVenue,
} from "@/components/admin/VenueQueue";

function serializeVenues(
  venues: Awaited<ReturnType<typeof listPendingVenuesForAdmin>>
): PendingVenue[] {
  return venues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    area: venue.area,
    subArea: venue.subArea,
    venueLinkUrl: venue.venueLinkUrl,
    venueLinkKind: venue.venueLinkKind,
    reviewStatus: venue.reviewStatus,
    reviewNote: venue.reviewNote,
    createdAt: venue.createdAt.toISOString(),
    recruiterEmail: venue.recruiterEmail,
    recruiterVerificationStatus: venue.recruiterVerificationStatus,
    organizationName: venue.organizationName,
  }));
}

export default async function AdminVenuesPage(): Promise<React.ReactElement> {
  await requireAdminPage("/admin/venues");
  const pending = await listPendingVenuesForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Venues</h1>
        <p className="text-charcoal-400 mt-1">
          Review venue links (Google Maps, Facebook, or Instagram) before they
          are shown to workers.
        </p>
      </div>
      <VenueQueue initialVenues={serializeVenues(pending)} />
    </div>
  );
}
