import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, venues, workerProfiles } from "@/lib/db/schema";

function firstName(full: string | null | undefined): string {
  const trimmed = full?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export async function lookupUserDisplayName(
  userId: string
): Promise<string> {
  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const fromUser = firstName(user?.name);
  if (fromUser) return fromUser;

  const [profile] = await db
    .select({ displayName: workerProfiles.displayName })
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, userId))
    .limit(1);
  return firstName(profile?.displayName) || "Someone";
}

export async function lookupVenueName(venueId: string): Promise<string> {
  const [venue] = await db
    .select({ name: venues.name })
    .from(venues)
    .where(eq(venues.id, venueId))
    .limit(1);
  return venue?.name?.trim() || "a venue";
}
