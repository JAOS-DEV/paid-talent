import { eq } from "drizzle-orm";
import { db, recruiterProfiles } from "@/lib/db";
import { listVenues } from "./service";

export interface OpeningVenueOption {
  id: string;
  name: string;
  isPrimary: boolean;
}

export async function listVenueOptionsForUser(
  userId: string
): Promise<OpeningVenueOption[]> {
  const [profile] = await db
    .select({ id: recruiterProfiles.id })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, userId))
    .limit(1);

  if (!profile) return [];

  const venues = await listVenues(profile.id);
  return venues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    isPrimary: venue.isPrimary,
  }));
}

export async function getVenueNameMapForProfile(
  recruiterProfileId: string
): Promise<Map<string, { name: string; logoUrl: string | null }>> {
  const venues = await listVenues(recruiterProfileId, { includeArchived: true });
  return new Map(
    venues.map((venue) => [
      venue.id,
      { name: venue.name, logoUrl: venue.logoUrl },
    ])
  );
}
