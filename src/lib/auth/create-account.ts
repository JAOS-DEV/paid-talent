import { db } from "@/lib/db";
import { recruiterProfiles, users, workerProfiles } from "@/lib/db/schema";
import type { UserRole } from "@/types/auth";
import { findActiveBannedIdentity } from "@/lib/auth/banned-identities";
import { normalizeVerifiedEmail } from "@/lib/auth/identity";

export interface CreatedAuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  ageVerified: boolean;
}

export async function createUserWithRole(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  role: UserRole;
  ageVerified: boolean;
  dateOfBirth?: string;
  ageVerifiedAt?: Date;
  now?: Date;
}): Promise<CreatedAuthUser> {
  const now = input.now ?? new Date();
  const email = normalizeVerifiedEmail(input.email);
  if (!email) {
    throw new Error("A verified email is required to create an account");
  }

  const activeBan = await findActiveBannedIdentity(email);
  if (activeBan) {
    throw new Error("This verified identity is banned from Paid Talent");
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name: input.name ?? null,
      image: input.image ?? null,
      role: input.role,
      ageVerified: input.ageVerified,
      dateOfBirth: input.dateOfBirth,
      ageVerifiedAt: input.ageVerifiedAt,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (input.role === "worker") {
    await db.insert(workerProfiles).values({
      userId: newUser.id,
      displayName: input.name || input.email.split("@")[0],
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await db.insert(recruiterProfiles).values({
      userId: newUser.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    image: newUser.image,
    role: input.role,
    ageVerified: newUser.ageVerified,
  };
}
