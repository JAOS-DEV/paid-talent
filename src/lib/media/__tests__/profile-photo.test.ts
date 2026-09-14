import { describe, it, expect } from "vitest";
import {
  PROFILE_PHOTO_ERRORS,
  PROFILE_PHOTO_MAX_BYTES,
  inspectProfilePhotoFile,
  parseSafeApiError,
  mapUploadNetworkError,
} from "../profile-photo";

describe("inspectProfilePhotoFile", () => {
  it("accepts JPEG under the 10MB limit", () => {
    expect(
      inspectProfilePhotoFile({
        name: "headshot.jpg",
        type: "image/jpeg",
        size: 2 * 1024 * 1024,
      })
    ).toEqual({ ok: true, contentType: "image/jpeg" });
  });

  it("returns an explicit size error above 10MB", () => {
    expect(
      inspectProfilePhotoFile({
        name: "huge.jpg",
        type: "image/jpeg",
        size: PROFILE_PHOTO_MAX_BYTES + 1,
      })
    ).toEqual({ ok: false, message: PROFILE_PHOTO_ERRORS.tooLarge });
  });

  it("returns a clear HEIC unsupported error", () => {
    expect(
      inspectProfilePhotoFile({
        name: "IMG_1234.HEIC",
        type: "image/heic",
        size: 800_000,
      })
    ).toEqual({ ok: false, message: PROFILE_PHOTO_ERRORS.heic });

    expect(
      inspectProfilePhotoFile({
        name: "IMG_1234.heif",
        type: "image/heif",
        size: 800_000,
      })
    ).toEqual({ ok: false, message: PROFILE_PHOTO_ERRORS.heic });
  });

  it("keeps Safari-converted JPEG working even if the filename is still .heic", () => {
    expect(
      inspectProfilePhotoFile({
        name: "IMG_1234.HEIC",
        type: "image/jpeg",
        size: 900_000,
      })
    ).toEqual({ ok: true, contentType: "image/jpeg" });
  });

  it("rejects unknown types with a useful message", () => {
    expect(
      inspectProfilePhotoFile({
        name: "notes.pdf",
        type: "application/pdf",
        size: 1000,
      })
    ).toEqual({ ok: false, message: PROFILE_PHOTO_ERRORS.invalidType });
  });
});

describe("safe error mapping", () => {
  it("prefers server message then error", () => {
    expect(
      parseSafeApiError({ message: "Upload limit reached" }, "fallback")
    ).toBe("Upload limit reached");
    expect(parseSafeApiError({ error: "Unauthorized" }, "fallback")).toBe(
      "Unauthorized"
    );
    expect(parseSafeApiError({ secret: "nope" }, "fallback")).toBe("fallback");
  });

  it("never surfaces Safari Load failed to the user", () => {
    expect(
      mapUploadNetworkError(
        new TypeError("Load failed"),
        PROFILE_PHOTO_ERRORS.uploadFailed
      )
    ).toBe(PROFILE_PHOTO_ERRORS.uploadFailed);
    expect(
      mapUploadNetworkError(
        new TypeError("Can only call Window.fetch on instances of Window."),
        PROFILE_PHOTO_ERRORS.uploadFailed
      )
    ).toBe(PROFILE_PHOTO_ERRORS.uploadFailed);
  });
});
