import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { listPendingVenuesForAdmin } from "@/lib/venues/review";

export async function GET(): Promise<NextResponse> {
  const guard = await requireAdminApi();
  if (!guard.ok) {
    return guard.response;
  }

  const pending = await listPendingVenuesForAdmin();

  return NextResponse.json({
    venues: pending.map((venue) => ({
      ...venue,
      createdAt: venue.createdAt.toISOString(),
    })),
  });
}
