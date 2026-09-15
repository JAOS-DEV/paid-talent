import { afterEach, describe, expect, it, vi } from "vitest";
import { workerProfiles, verificationEvents } from "@/lib/db/schema";
import { publicMediaUploadRequestSchema } from "@/lib/media/public-upload-request";
import {
  PRIVATE_SIGNED_GET_MAX_SECONDS,
  PRIVATE_VERIFICATION_BUCKET_FALLBACK,
  PrivateStorageConfigError,
  capPrivateSignedGetExpiry,
  getPrivateVerificationStorageConfig,
  getPublicMediaBucketName,
} from "@/lib/storage/config";
import {
  assertOwnedPhotoStagingKey,
  assertPhotoStagingObjectKey,
  assertPublicMediaObjectKey,
  isForbiddenPublicMediaKey,
} from "@/lib/storage/keys";
import { resolvePrivateVerificationReadAccess } from "@/lib/storage/private-access";
import {
  deleteFile,
  deletePrivateFile,
  getPublicUrl,
  getSignedIdDocumentUrl,
  getSignedLivenessVideoUrl,
  getSignedPhotoStagingUrlForAdmin,
  getSignedPhotoStagingUrlForOwner,
} from "@/lib/storage/s3";
import {
  getIdDocumentUploadTarget,
  getLivenessVideoUploadTarget,
  getProfilePhotoStagingUploadTarget,
  getProfilePhotoUploadTarget,
} from "@/lib/storage/targets";
import {
  WORKER_VERIFICATION_FORBIDDEN_FIELDS,
  toWorkerVerificationStatusDto,
} from "@/lib/verification";

function stubSeparatedBuckets(): void {
  vi.stubEnv("S3_BUCKET_NAME", "paid-talent-media");
  vi.stubEnv("S3_ACCESS_KEY_ID", "public-media-key");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "public-media-secret");
  vi.stubEnv("S3_PRIVATE_BUCKET_NAME", "paid-talent-private");
  vi.stubEnv("S3_PRIVATE_ACCESS_KEY_ID", "private-verification-key");
  vi.stubEnv("S3_PRIVATE_SECRET_ACCESS_KEY", "private-verification-secret");
  vi.stubEnv("S3_CDN_URL", "https://media.example.com");
  vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
}

describe("two-bucket storage security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("targets approved profile photos at paid-talent-media under profiles/", () => {
    stubSeparatedBuckets();
    const target = getProfilePhotoUploadTarget("user-1", "jpeg");
    expect(target.client).toBe("public");
    expect(target.bucket).toBe("paid-talent-media");
    expect(target.bucket).toBe(getPublicMediaBucketName());
    expect(target.key.startsWith("profiles/user-1/")).toBe(true);
    expect(target.credentialSource).toBe("S3_ACCESS_KEY_ID");
    expect(target.generatesPublicCdnUrl).toBe(true);
    expect(isForbiddenPublicMediaKey(target.key)).toBe(false);
    expect(getPublicUrl(target.key).startsWith("https://media.example.com/profiles/user-1/")).toBe(
      true
    );
  });

  it("targets newly selected profile photos at paid-talent-private under profile-photo-staging/", () => {
    stubSeparatedBuckets();
    const target = getProfilePhotoStagingUploadTarget("user-1", "jpeg");
    expect(target.client).toBe("private");
    expect(target.bucket).toBe("paid-talent-private");
    expect(target.key.startsWith("profile-photo-staging/user-1/")).toBe(true);
    expect(target.credentialSource).toBe("S3_PRIVATE_ACCESS_KEY_ID");
    expect(target.generatesPublicCdnUrl).toBe(false);
    expect(isForbiddenPublicMediaKey(target.key)).toBe(true);
  });

  it("targets ID uploads at paid-talent-private under verification-docs/", () => {
    stubSeparatedBuckets();
    const target = getIdDocumentUploadTarget("user-1", "jpg");
    expect(target.client).toBe("private");
    expect(target.bucket).toBe("paid-talent-private");
    expect(target.key.startsWith("verification-docs/user-1/")).toBe(true);
    expect(target.credentialSource).toBe("S3_PRIVATE_ACCESS_KEY_ID");
    expect(target.generatesPublicCdnUrl).toBe(false);
  });

  it("targets liveness uploads at paid-talent-private under verification-liveness/", () => {
    stubSeparatedBuckets();
    const target = getLivenessVideoUploadTarget("user-1", "mp4");
    expect(target.client).toBe("private");
    expect(target.bucket).toBe("paid-talent-private");
    expect(target.key.startsWith("verification-liveness/user-1/")).toBe(true);
    expect(target.credentialSource).toBe("S3_PRIVATE_ACCESS_KEY_ID");
    expect(target.generatesPublicCdnUrl).toBe(false);
  });

  it("uses distinct private credentials and never the public bucket", () => {
    stubSeparatedBuckets();
    const config = getPrivateVerificationStorageConfig();
    expect(config.credentialSource).toBe("S3_PRIVATE_ACCESS_KEY_ID");
    expect(config.accessKeyId).toBe("private-verification-key");
    expect(config.accessKeyId).not.toBe(process.env.S3_ACCESS_KEY_ID);
    expect(config.bucketName).toBe("paid-talent-private");
    expect(config.bucketName).toBe(PRIVATE_VERIFICATION_BUCKET_FALLBACK);
    expect(config.bucketName).not.toBe(getPublicMediaBucketName());
  });

  it("rejects public media keys for documents, verification, and staging prefixes", () => {
    expect(isForbiddenPublicMediaKey("documents/user-1/id.jpg")).toBe(true);
    expect(isForbiddenPublicMediaKey("verification-docs/user-1/id.jpg")).toBe(
      true
    );
    expect(
      isForbiddenPublicMediaKey("verification-liveness/user-1/live.mp4")
    ).toBe(true);
    expect(
      isForbiddenPublicMediaKey("profile-photo-staging/user-1/photo.jpeg")
    ).toBe(true);
    expect(() =>
      assertPublicMediaObjectKey("verification-docs/user-1/id.jpg")
    ).toThrow("PUBLIC_MEDIA_FORBIDDEN_KEY");
    expect(() =>
      assertPublicMediaObjectKey("profile-photo-staging/user-1/photo.jpeg")
    ).toThrow("PUBLIC_MEDIA_FORBIDDEN_KEY");
    expect(() =>
      assertPublicMediaObjectKey("profiles/user-1/photo.jpeg")
    ).not.toThrow();
  });

  it("rejects folder documents, verification, and staging on the generic public media route", () => {
    const allowed = publicMediaUploadRequestSchema.safeParse({
      contentType: "image/jpeg",
      folder: "profiles",
      contentLength: 2048,
    });
    const documents = publicMediaUploadRequestSchema.safeParse({
      contentType: "image/jpeg",
      folder: "documents",
      contentLength: 2048,
    });
    const staging = publicMediaUploadRequestSchema.safeParse({
      contentType: "image/jpeg",
      folder: "profile-photo-staging",
      contentLength: 2048,
    });
    const verification = publicMediaUploadRequestSchema.safeParse({
      contentType: "image/jpeg",
      folder: "verification-docs",
      contentLength: 2048,
    });

    expect(allowed.success).toBe(true);
    expect(documents.success).toBe(false);
    expect(staging.success).toBe(false);
    expect(verification.success).toBe(false);
  });

  it("never builds S3_CDN_URL for private verification or photo staging uploads", () => {
    stubSeparatedBuckets();
    expect(getIdDocumentUploadTarget("user-1", "jpg").generatesPublicCdnUrl).toBe(
      false
    );
    expect(
      getLivenessVideoUploadTarget("user-1", "mp4").generatesPublicCdnUrl
    ).toBe(false);
    expect(
      getProfilePhotoStagingUploadTarget("user-1", "jpeg").generatesPublicCdnUrl
    ).toBe(false);
  });

  it("fails closed when private configuration is missing", () => {
    vi.stubEnv("S3_BUCKET_NAME", "paid-talent-media");
    vi.stubEnv("S3_ACCESS_KEY_ID", "public-media-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "public-media-secret");
    vi.stubEnv("S3_PRIVATE_BUCKET_NAME", "");
    vi.stubEnv("S3_PRIVATE_ACCESS_KEY_ID", "");
    vi.stubEnv("S3_PRIVATE_SECRET_ACCESS_KEY", "");

    expect(() => getPrivateVerificationStorageConfig()).toThrow(
      PrivateStorageConfigError
    );
    expect(() => getIdDocumentUploadTarget("user-1", "jpg")).toThrow(
      PrivateStorageConfigError
    );
  });

  it("does not fall back to the public bucket or public credentials", () => {
    vi.stubEnv("S3_BUCKET_NAME", "paid-talent-media");
    vi.stubEnv("S3_ACCESS_KEY_ID", "shared-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "public-media-secret");
    vi.stubEnv("S3_PRIVATE_BUCKET_NAME", "paid-talent-media");
    vi.stubEnv("S3_PRIVATE_ACCESS_KEY_ID", "private-verification-key");
    vi.stubEnv("S3_PRIVATE_SECRET_ACCESS_KEY", "private-verification-secret");

    expect(() => getPrivateVerificationStorageConfig()).toThrow(
      /distinct from the public media bucket/
    );

    vi.stubEnv("S3_PRIVATE_BUCKET_NAME", "paid-talent-private");
    vi.stubEnv("S3_PRIVATE_ACCESS_KEY_ID", "shared-key");

    expect(() => getPrivateVerificationStorageConfig()).toThrow(
      /must not reuse public media credentials/
    );
  });

  it("refuses to delete public objects through the private client", async () => {
    await expect(deletePrivateFile("profiles/user-1/photo.jpeg")).rejects.toThrow(
      "PRIVATE_VERIFICATION_INVALID_KEY"
    );
  });

  it("refuses to delete private verification objects through the public client", async () => {
    await expect(
      deleteFile("verification-docs/user-1/id.jpg")
    ).rejects.toThrow("PUBLIC_MEDIA_FORBIDDEN_KEY");
  });

  it("refuses to delete staged photos through the public client", async () => {
    await expect(
      deleteFile("profile-photo-staging/user-1/photo.jpeg")
    ).rejects.toThrow("PUBLIC_MEDIA_FORBIDDEN_KEY");
  });

  it("refuses to delete staged photos through the identity private deleter", async () => {
    await expect(
      deletePrivateFile("profile-photo-staging/user-1/photo.jpeg")
    ).rejects.toThrow("PRIVATE_VERIFICATION_INVALID_KEY");
  });

  it("denies unauthenticated, worker, recruiter, and non-admin reads of ID media", () => {
    stubSeparatedBuckets();

    expect(
      resolvePrivateVerificationReadAccess({
        isAuthenticated: false,
        email: null,
      }).allowed
    ).toBe(false);

    expect(
      resolvePrivateVerificationReadAccess({
        isAuthenticated: true,
        email: "worker@example.com",
        role: "worker",
      })
    ).toEqual({ allowed: false, reason: "worker" });

    expect(
      resolvePrivateVerificationReadAccess({
        isAuthenticated: true,
        email: "recruiter@example.com",
        role: "recruiter",
      })
    ).toEqual({ allowed: false, reason: "recruiter" });

    expect(
      resolvePrivateVerificationReadAccess({
        isAuthenticated: true,
        email: "someone@example.com",
        role: "worker",
      }).allowed
    ).toBe(false);
  });

  it("allows only allowlisted admins to obtain private verification signed GETs", async () => {
    stubSeparatedBuckets();

    await expect(
      getSignedIdDocumentUrl(
        "worker@example.com",
        "verification-docs/user-1/id.jpg"
      )
    ).rejects.toThrow("Not allowed to access private verification media");

    const adminAccess = resolvePrivateVerificationReadAccess({
      isAuthenticated: true,
      email: "admin@example.com",
      role: "worker",
    });
    expect(adminAccess).toEqual({
      allowed: true,
      email: "admin@example.com",
    });
  });

  it("caps signed GET expiry at 300 seconds", () => {
    expect(PRIVATE_SIGNED_GET_MAX_SECONDS).toBe(300);
    expect(capPrivateSignedGetExpiry(900)).toBe(300);
    expect(capPrivateSignedGetExpiry(60)).toBe(60);
    expect(capPrivateSignedGetExpiry(undefined)).toBe(300);
  });

  it("does not persist signed URLs on worker or verification tables", () => {
    expect(workerProfiles.idDocumentKey).toBeDefined();
    expect(workerProfiles.livenessVideoKey).toBeDefined();
    expect(
      Object.prototype.hasOwnProperty.call(workerProfiles, "idDocumentUrl")
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(workerProfiles, "livenessVideoUrl")
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(verificationEvents, "idDocumentUrl")
    ).toBe(false);
  });

  it("never returns ID/liveness URLs or keys on the worker verification status DTO", () => {
    const dto = toWorkerVerificationStatusDto({
      verificationStatus: "pending",
      idDocumentSubmittedAt: new Date(),
      verificationReviewedAt: null,
      challengeCode: "123456",
    });

    for (const field of WORKER_VERIFICATION_FORBIDDEN_FIELDS) {
      expect(dto).not.toHaveProperty(field);
    }
    expect(dto.hasIdDocument).toBe(true);
    expect(dto.hasChallengeCode).toBe(true);
  });

  it("does not let non-admins obtain a pending-photo private preview", async () => {
    stubSeparatedBuckets();
    await expect(
      getSignedPhotoStagingUrlForAdmin(
        "worker@example.com",
        "profile-photo-staging/user-1/photo.jpeg"
      )
    ).rejects.toThrow("Not allowed to access private verification media");
  });

  it("does not let another worker obtain an owner pending-photo preview", async () => {
    stubSeparatedBuckets();
    await expect(
      getSignedPhotoStagingUrlForOwner(
        "user-2",
        "profile-photo-staging/user-1/photo.jpeg"
      )
    ).rejects.toThrow("PHOTO_STAGING_KEY_NOT_OWNED");
  });

  it("scopes photo staging preview away from identity objects", async () => {
    stubSeparatedBuckets();
    await expect(
      getSignedPhotoStagingUrlForAdmin(
        "admin@example.com",
        "verification-docs/user-1/id.jpg"
      )
    ).rejects.toThrow("PHOTO_STAGING_INVALID_KEY");
    await expect(
      getSignedPhotoStagingUrlForAdmin(
        "admin@example.com",
        "verification-liveness/user-1/live.mp4"
      )
    ).rejects.toThrow("PHOTO_STAGING_INVALID_KEY");
    expect(() =>
      assertPhotoStagingObjectKey("verification-docs/user-1/id.jpg")
    ).toThrow("PHOTO_STAGING_INVALID_KEY");
  });

  it("scopes identity admin preview away from photo staging objects", async () => {
    stubSeparatedBuckets();
    await expect(
      getSignedIdDocumentUrl(
        "admin@example.com",
        "profile-photo-staging/user-1/photo.jpeg"
      )
    ).rejects.toThrow("PRIVATE_VERIFICATION_INVALID_KEY");
    await expect(
      getSignedLivenessVideoUrl(
        "admin@example.com",
        "profile-photo-staging/user-1/photo.jpeg"
      )
    ).rejects.toThrow("PRIVATE_VERIFICATION_INVALID_KEY");
  });

  it("requires photo staging keys to be owned by the uploading worker", () => {
    expect(() =>
      assertOwnedPhotoStagingKey(
        "user-1",
        "profile-photo-staging/user-2/photo.jpeg"
      )
    ).toThrow("PHOTO_STAGING_KEY_NOT_OWNED");
    expect(() =>
      assertOwnedPhotoStagingKey(
        "user-1",
        "profile-photo-staging/user-1/photo.jpeg"
      )
    ).not.toThrow();
  });
});
