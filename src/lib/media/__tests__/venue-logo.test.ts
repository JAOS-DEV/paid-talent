import { describe, expect, it, vi } from "vitest";
import type { PhotoAnalysisResult } from "@/lib/moderation/photo-policy";
import {
  decideVenueLogoPublication,
  imageTypesMatch,
  sniffAllowedImageType,
  toPublicVenueLogoUrl,
  VENUE_LOGO_ERRORS,
} from "@/lib/media/venue-logo";
import {
  clearVenueLogo,
  confirmVenueLogo,
  presignVenueLogo,
  type VenueLogoStorage,
  type VenueLogoStore,
} from "@/lib/media/venue-logo-service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const STAGING_KEY = `profile-photo-staging/${USER_ID}/logo.jpeg`;
const PUBLIC_KEY = `profiles/${USER_ID}/logo.jpeg`;
const PUBLIC_URL = "https://cdn.example/profiles/user/logo.jpeg";
const OLD_KEY = `profiles/${USER_ID}/old-logo.jpeg`;

function jpegBytes(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
}

function memoryStore(
  initial: { profileId: string; logoKey: string | null } | null
): VenueLogoStore & {
  saved: { logoKey: string | null; logoUrl: string | null } | null;
} {
  let record = initial;
  const store = {
    saved: null as { logoKey: string | null; logoUrl: string | null } | null,
    async getLogo() {
      return record;
    },
    async setLogo(
      _profileId: string,
      logo: { logoKey: string | null; logoUrl: string | null }
    ) {
      store.saved = logo;
      if (record) {
        record = { ...record, logoKey: logo.logoKey };
      }
    },
  };
  return store;
}

function storage(
  overrides: Partial<VenueLogoStorage> = {}
): VenueLogoStorage {
  return {
    presignStaging: vi.fn(async () => ({
      uploadUrl: "https://upload.example/put",
      key: STAGING_KEY,
    })),
    assertStagedWithinLimit: vi.fn(async () => ({
      contentLength: 4,
      contentType: "image/jpeg",
    })),
    readStaged: vi.fn(async () => jpegBytes()),
    signedStagingGet: vi.fn(async () => "https://signed.example/staged"),
    deleteStaged: vi.fn(async () => undefined),
    promote: vi.fn(async () => ({
      photoKey: PUBLIC_KEY,
      photoUrl: PUBLIC_URL,
    })),
    deletePublic: vi.fn(async () => undefined),
    ...overrides,
  };
}

const safeAnalysis: PhotoAnalysisResult = {
  categories: ["safe"],
  confidence: 0.95,
};

describe("venue logo validation", () => {
  it("sniffs jpeg, png, gif, and webp and rejects other bytes", () => {
    expect(sniffAllowedImageType(jpegBytes())).toBe("image/jpeg");
    expect(
      sniffAllowedImageType(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe("image/png");
    expect(sniffAllowedImageType(Uint8Array.from(Buffer.from("GIF89a")))).toBe(
      "image/gif"
    );
    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    expect(sniffAllowedImageType(webp)).toBe("image/webp");
    expect(sniffAllowedImageType(Uint8Array.from(Buffer.from("%PDF-1.7")))).toBe(
      null
    );
    expect(sniffAllowedImageType(Uint8Array.from(Buffer.from("<html>")))).toBe(
      null
    );
  });

  it("requires the declared content type to match the sniffed image", () => {
    expect(imageTypesMatch("image/jpeg", "image/jpeg")).toBe(true);
    expect(imageTypesMatch("image/png; charset=binary", "image/png")).toBe(
      true
    );
    expect(imageTypesMatch("image/png", "image/jpeg")).toBe(false);
    expect(imageTypesMatch("text/html", "image/jpeg")).toBe(false);
    expect(imageTypesMatch(undefined, "image/jpeg")).toBe(true);
  });

  it("blocks hard policy rejects and publishes lighter review categories", () => {
    expect(
      decideVenueLogoPublication({
        categories: ["explicit_nudity"],
        confidence: 0.99,
      }).publish
    ).toBe(false);
    expect(
      decideVenueLogoPublication({
        categories: ["violence"],
        confidence: 0.9,
      }).publish
    ).toBe(false);
    expect(
      decideVenueLogoPublication({
        categories: ["lingerie_swimwear"],
        confidence: 0.88,
      }).publish
    ).toBe(true);
    expect(decideVenueLogoPublication(safeAnalysis).publish).toBe(true);
  });

  it("drops signed or non-http logo urls", () => {
    expect(toPublicVenueLogoUrl(PUBLIC_URL)).toBe(PUBLIC_URL);
    expect(toPublicVenueLogoUrl("")).toBeNull();
    expect(
      toPublicVenueLogoUrl(
        "https://cdn.example/logo.jpeg?X-Amz-Signature=abc"
      )
    ).toBeNull();
    expect(toPublicVenueLogoUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("venue logo upload service", () => {
  it("refuses a presign when the recruiter has no profile", async () => {
    const store = memoryStore(null);
    const media = storage();
    const result = await presignVenueLogo(USER_ID, "image/jpeg", 128, {
      store,
      storage: media,
    });
    expect(result).toEqual({
      ok: false,
      status: 404,
      message: VENUE_LOGO_ERRORS.profileMissing,
    });
    expect(media.presignStaging).not.toHaveBeenCalled();
  });

  it("presigns staging storage for an existing profile", async () => {
    const result = await presignVenueLogo(USER_ID, "image/jpeg", 128, {
      store: memoryStore({ profileId: "profile-1", logoKey: null }),
      storage: storage(),
    });
    expect(result).toEqual({
      ok: true,
      uploadUrl: "https://upload.example/put",
      key: STAGING_KEY,
    });
  });

  it("rejects another recruiter's staging key before reading it", async () => {
    const media = storage();
    const result = await confirmVenueLogo(
      USER_ID,
      "profile-photo-staging/someone-else/logo.jpeg",
      {
        store: memoryStore({ profileId: "profile-1", logoKey: null }),
        storage: media,
        analyze: async () => safeAnalysis,
      }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
    expect(media.readStaged).not.toHaveBeenCalled();
    expect(media.promote).not.toHaveBeenCalled();
  });

  it("deletes staging and rejects non-image bytes", async () => {
    const media = storage({
      readStaged: vi.fn(async () => Buffer.from("<html><script>")),
    });
    const store = memoryStore({ profileId: "profile-1", logoKey: null });
    const result = await confirmVenueLogo(USER_ID, STAGING_KEY, {
      store,
      storage: media,
      analyze: async () => safeAnalysis,
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      message: VENUE_LOGO_ERRORS.invalidType,
    });
    expect(media.deleteStaged).toHaveBeenCalledWith(STAGING_KEY);
    expect(media.promote).not.toHaveBeenCalled();
    expect(store.saved).toBeNull();
  });

  it("does not publish explicit images", async () => {
    const media = storage();
    const result = await confirmVenueLogo(USER_ID, STAGING_KEY, {
      store: memoryStore({ profileId: "profile-1", logoKey: null }),
      storage: media,
      analyze: async () => ({
        categories: ["explicit_nudity"],
        confidence: 0.99,
      }),
    });
    expect(result).toMatchObject({
      ok: false,
      message: VENUE_LOGO_ERRORS.rejected,
    });
    expect(media.deleteStaged).toHaveBeenCalledWith(STAGING_KEY);
    expect(media.promote).not.toHaveBeenCalled();
  });

  it("publishes a safe logo and deletes the previous owned object", async () => {
    const media = storage();
    const store = memoryStore({ profileId: "profile-1", logoKey: OLD_KEY });
    const result = await confirmVenueLogo(USER_ID, STAGING_KEY, {
      store,
      storage: media,
      analyze: async () => safeAnalysis,
    });
    expect(result).toEqual({
      ok: true,
      logoKey: PUBLIC_KEY,
      logoUrl: PUBLIC_URL,
    });
    expect(store.saved).toEqual({ logoKey: PUBLIC_KEY, logoUrl: PUBLIC_URL });
    expect(media.deletePublic).toHaveBeenCalledWith(OLD_KEY);
  });

  it("does not persist a signed upload url", async () => {
    const media = storage({
      promote: vi.fn(async () => ({
        photoKey: PUBLIC_KEY,
        photoUrl: `${PUBLIC_URL}?X-Amz-Signature=secret`,
      })),
    });
    const store = memoryStore({ profileId: "profile-1", logoKey: null });
    const result = await confirmVenueLogo(USER_ID, STAGING_KEY, {
      store,
      storage: media,
      analyze: async () => safeAnalysis,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
    expect(store.saved).toBeNull();
    expect(media.deletePublic).toHaveBeenCalledWith(PUBLIC_KEY);
  });

  it("clears the saved logo and deletes only an owned public object", async () => {
    const media = storage();
    const store = memoryStore({ profileId: "profile-1", logoKey: OLD_KEY });
    const result = await clearVenueLogo(USER_ID, { store, storage: media });
    expect(result).toEqual({ ok: true });
    expect(store.saved).toEqual({ logoKey: null, logoUrl: null });
    expect(media.deletePublic).toHaveBeenCalledWith(OLD_KEY);
  });

  it("does not delete another user's object when clearing a bad key", async () => {
    const media = storage();
    const store = memoryStore({
      profileId: "profile-1",
      logoKey: "profiles/other-user/logo.jpeg",
    });
    const result = await clearVenueLogo(USER_ID, { store, storage: media });
    expect(result).toEqual({ ok: true });
    expect(store.saved).toEqual({ logoKey: null, logoUrl: null });
    expect(media.deletePublic).not.toHaveBeenCalled();
  });
});
