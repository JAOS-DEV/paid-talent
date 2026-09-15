import { describe, expect, it } from "vitest";
import {
  CONTACT_CIRCUMVENTION_MESSAGE,
  validatePublicProfileText,
} from "../public-text";
import { PROFANITY_BLOCKED_MESSAGE } from "@/lib/helpers/profanity-filter";
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  EXPERIENCE_DESCRIPTION_MAX_LENGTH,
} from "../limits";

describe("validatePublicProfileText", () => {
  it("accepts clean professional copy", () => {
    expect(
      validatePublicProfileText("Somchai P.", "displayName")
    ).toBeNull();
    expect(
      validatePublicProfileText(
        "Five years in nightlife hospitality across Pattaya.",
        "experience"
      )
    ).toBeNull();
    expect(
      validatePublicProfileText(
        "Friendly bartender who loves high-volume service.",
        "bio"
      )
    ).toBeNull();
  });

  it("rejects profanity in bio", () => {
    const error = validatePublicProfileText("fuck off cunt", "bio");
    expect(error?.type).toBe("profanity");
    expect(error?.message).toBe(PROFANITY_BLOCKED_MESSAGE);
  });

  it("rejects contact circumvention attempts", () => {
    const samples = [
      "IG: myname123",
      "instagram @myname",
      "LINE: abc123",
      "call me 0812345678",
      "wa.me/66812345678",
      "myname@gmail.com",
      "https://instagram.com/myname",
    ];

    for (const sample of samples) {
      const error = validatePublicProfileText(sample, "bio");
      expect(error?.type, sample).toBe("blocked_contact");
      expect(error?.message, sample).toBe(CONTACT_CIRCUMVENTION_MESSAGE);
    }
  });

  it("enforces field-specific length limits", () => {
    expect(
      validatePublicProfileText("A".repeat(DISPLAY_NAME_MAX_LENGTH + 1), "displayName")
        ?.type
    ).toBe("too_long");
    expect(
      validatePublicProfileText(
        "A".repeat(EXPERIENCE_DESCRIPTION_MAX_LENGTH + 1),
        "experience"
      )?.type
    ).toBe("too_long");
    expect(
      validatePublicProfileText("A".repeat(BIO_MAX_LENGTH + 1), "bio")?.type
    ).toBe("too_long");
    expect(
      validatePublicProfileText("A".repeat(BIO_MAX_LENGTH), "bio")
    ).toBeNull();
    expect(
      validatePublicProfileText("short", "bio")?.type
    ).toBe("too_short");
  });

  it("allows empty optional fields", () => {
    expect(validatePublicProfileText("", "experience")).toBeNull();
    expect(validatePublicProfileText("  ", "area")).toBeNull();
  });
});
