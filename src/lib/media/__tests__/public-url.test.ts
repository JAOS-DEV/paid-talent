import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PublicMediaConfigError,
  buildPublicMediaUrl,
  isPersistablePublicMediaUrl,
  resolvePublicMediaBaseUrl,
} from "../public-url";
import { getPublicUrl } from "@/lib/storage/s3";

describe("resolvePublicMediaBaseUrl / buildPublicMediaUrl", () => {
  it("uses S3_CDN_URL when configured", () => {
    expect(
      buildPublicMediaUrl("profiles/u1/photo.jpeg", {
        cdnUrl: "https://media.example.com/",
        endpoint: "https://abc.r2.cloudflarestorage.com",
        bucketName: "paid-talent-media",
      })
    ).toBe("https://media.example.com/profiles/u1/photo.jpeg");
  });

  it("does not treat the R2 S3 API endpoint as a public production media URL", () => {
    expect(() =>
      resolvePublicMediaBaseUrl({
        endpoint: "https://abc.r2.cloudflarestorage.com",
        bucketName: "paid-talent-media",
      })
    ).toThrow(PublicMediaConfigError);

    expect(() =>
      buildPublicMediaUrl("profiles/u1/photo.jpeg", {
        endpoint: "https://abc.r2.cloudflarestorage.com/paid-talent-media",
        bucketName: "paid-talent-media",
      })
    ).toThrow(/S3_CDN_URL is required/);
  });

  it("rejects an S3_CDN_URL that points at the R2 S3 API", () => {
    expect(() =>
      resolvePublicMediaBaseUrl({
        cdnUrl: "https://abc.r2.cloudflarestorage.com/paid-talent-media",
      })
    ).toThrow(/cannot be the R2 S3 API endpoint/);
  });

  it("allows a non-R2 custom endpoint when no CDN is set", () => {
    expect(
      buildPublicMediaUrl("profiles/u1/photo.jpeg", {
        endpoint: "https://minio.example.com",
        bucketName: "paid-talent-media",
      })
    ).toBe("https://minio.example.com/paid-talent-media/profiles/u1/photo.jpeg");
  });

  it("falls back to a virtual-hosted AWS URL without an endpoint or CDN", () => {
    expect(
      buildPublicMediaUrl("profiles/u1/photo.jpeg", {
        bucketName: "paid-talent-media",
        region: "us-east-1",
      })
    ).toBe(
      "https://paid-talent-media.s3.us-east-1.amazonaws.com/profiles/u1/photo.jpeg"
    );
  });
});

describe("isPersistablePublicMediaUrl", () => {
  it("accepts a public CDN or custom media domain", () => {
    expect(isPersistablePublicMediaUrl("https://media.example.com/p.jpg")).toBe(
      true
    );
    expect(
      isPersistablePublicMediaUrl("https://pub-abc.r2.dev/profiles/u1/p.jpeg")
    ).toBe(true);
  });

  it("rejects R2 S3 API URLs and signed GET URLs", () => {
    expect(
      isPersistablePublicMediaUrl(
        "https://abc.r2.cloudflarestorage.com/paid-talent-media/profiles/u1/p.jpeg"
      )
    ).toBe(false);
    expect(
      isPersistablePublicMediaUrl(
        "https://media.example.com/p.jpg?X-Amz-Signature=abc"
      )
    ).toBe(false);
  });
});

describe("getPublicUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses S3_CDN_URL when configured", () => {
    vi.stubEnv("S3_CDN_URL", "https://media.example.com");
    vi.stubEnv("S3_ENDPOINT", "https://abc.r2.cloudflarestorage.com");
    vi.stubEnv("S3_BUCKET_NAME", "paid-talent-media");

    expect(getPublicUrl("profiles/u1/photo.jpeg")).toBe(
      "https://media.example.com/profiles/u1/photo.jpeg"
    );
  });

  it("does not treat the R2 API endpoint as a public URL when S3_CDN_URL is required", () => {
    vi.stubEnv("S3_CDN_URL", "");
    vi.stubEnv("S3_ENDPOINT", "https://abc.r2.cloudflarestorage.com");
    vi.stubEnv("S3_BUCKET_NAME", "paid-talent-media");

    expect(() => getPublicUrl("profiles/u1/photo.jpeg")).toThrow(
      PublicMediaConfigError
    );
  });
});
