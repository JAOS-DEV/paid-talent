import { eq } from "drizzle-orm";
import { db, recruiterProfiles, workerProfiles } from "@/lib/db";
import type {
  RecruiterProfile,
  VerificationStatus,
  WorkerProfile,
} from "@/lib/db/schema";

export type SubjectType = "worker" | "recruiter";

export interface VerificationSubjectRecord {
  id: string;
  userId: string;
  verificationStatus: VerificationStatus;
  isVerified: boolean;
  idDocumentKey: string | null;
  livenessVideoKey: string | null;
  challengeCode: string | null;
  challengeIssuedAt: Date | null;
  idDocumentSubmittedAt: Date | null;
  verificationReviewedAt: Date | null;
  verificationReviewedBy: string | null;
  verifiedAt: Date | null;
  displayName: string | null;
  organizationName: string | null;
}

export type VerificationSubjectPatch = Partial<{
  verificationStatus: VerificationStatus;
  isVerified: boolean;
  idDocumentKey: string | null;
  livenessVideoKey: string | null;
  challengeCode: string | null;
  challengeIssuedAt: Date | null;
  idDocumentSubmittedAt: Date | null;
  verificationReviewedAt: Date | null;
  verificationReviewedBy: string | null;
  verifiedAt: Date | null;
  updatedAt: Date;
}>;

export type VerificationEventFk =
  | { workerProfileId: string; recruiterProfileId?: never }
  | { recruiterProfileId: string; workerProfileId?: never };

export interface VerificationSubjectAdapter {
  type: SubjectType;
  actorType: SubjectType;
  profileNotFoundError: string;
  loadByUserId(userId: string): Promise<VerificationSubjectRecord | null>;
  loadById(id: string): Promise<VerificationSubjectRecord | null>;
  update(
    id: string,
    patch: VerificationSubjectPatch
  ): Promise<VerificationSubjectRecord>;
  eventFk(id: string): VerificationEventFk;
  ensureByUserId(userId: string): Promise<VerificationSubjectRecord>;
}

function fromWorker(profile: WorkerProfile): VerificationSubjectRecord {
  return {
    id: profile.id,
    userId: profile.userId,
    verificationStatus: profile.verificationStatus,
    isVerified: profile.isVerified,
    idDocumentKey: profile.idDocumentKey,
    livenessVideoKey: profile.livenessVideoKey,
    challengeCode: profile.challengeCode,
    challengeIssuedAt: profile.challengeIssuedAt,
    idDocumentSubmittedAt: profile.idDocumentSubmittedAt,
    verificationReviewedAt: profile.verificationReviewedAt,
    verificationReviewedBy: profile.verificationReviewedBy,
    verifiedAt: null,
    displayName: profile.displayName,
    organizationName: null,
  };
}

function fromRecruiter(profile: RecruiterProfile): VerificationSubjectRecord {
  return {
    id: profile.id,
    userId: profile.userId,
    verificationStatus: profile.verificationStatus,
    isVerified: profile.isVerified,
    idDocumentKey: profile.idDocumentKey,
    livenessVideoKey: profile.livenessVideoKey,
    challengeCode: profile.challengeCode,
    challengeIssuedAt: profile.challengeIssuedAt,
    idDocumentSubmittedAt: profile.idDocumentSubmittedAt,
    verificationReviewedAt: profile.verificationReviewedAt,
    verificationReviewedBy: profile.verificationReviewedBy,
    verifiedAt: profile.verifiedAt,
    displayName: profile.organizationName,
    organizationName: profile.organizationName,
  };
}

export const workerVerificationSubject: VerificationSubjectAdapter = {
  type: "worker",
  actorType: "worker",
  profileNotFoundError: "Worker profile not found",

  async loadByUserId(userId) {
    const [profile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, userId))
      .limit(1);
    return profile ? fromWorker(profile) : null;
  },

  async loadById(id) {
    const [profile] = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.id, id))
      .limit(1);
    return profile ? fromWorker(profile) : null;
  },

  async update(id, patch) {
    const [updated] = await db
      .update(workerProfiles)
      .set(patch)
      .where(eq(workerProfiles.id, id))
      .returning();
    return fromWorker(updated);
  },

  eventFk(id) {
    return { workerProfileId: id };
  },

  async ensureByUserId(userId) {
    const existing = await this.loadByUserId(userId);
    if (existing) {
      return existing;
    }
    throw new Error(this.profileNotFoundError);
  },
};

export const recruiterVerificationSubject: VerificationSubjectAdapter = {
  type: "recruiter",
  actorType: "recruiter",
  profileNotFoundError: "Recruiter profile not found",

  async loadByUserId(userId) {
    const [profile] = await db
      .select()
      .from(recruiterProfiles)
      .where(eq(recruiterProfiles.userId, userId))
      .limit(1);
    return profile ? fromRecruiter(profile) : null;
  },

  async loadById(id) {
    const [profile] = await db
      .select()
      .from(recruiterProfiles)
      .where(eq(recruiterProfiles.id, id))
      .limit(1);
    return profile ? fromRecruiter(profile) : null;
  },

  async update(id, patch) {
    const [updated] = await db
      .update(recruiterProfiles)
      .set(patch)
      .where(eq(recruiterProfiles.id, id))
      .returning();
    return fromRecruiter(updated);
  },

  eventFk(id) {
    return { recruiterProfileId: id };
  },

  async ensureByUserId(userId) {
    const existing = await this.loadByUserId(userId);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const [created] = await db
      .insert(recruiterProfiles)
      .values({
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return fromRecruiter(created);
  },
};

export function getVerificationSubject(
  type: SubjectType
): VerificationSubjectAdapter {
  return type === "worker"
    ? workerVerificationSubject
    : recruiterVerificationSubject;
}
