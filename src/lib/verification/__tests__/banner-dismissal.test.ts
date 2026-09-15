import { describe, expect, it } from "vitest";
import {
  isVerifiedLiveSuccessState,
  verifiedBannerStorageKey,
} from "../banner-dismissal";

describe("verified banner dismissal", () => {
  it("only treats verified + published as the dismissible success state", () => {
    expect(isVerifiedLiveSuccessState("verified", true)).toBe(true);
    expect(isVerifiedLiveSuccessState("verified", false)).toBe(false);
    expect(isVerifiedLiveSuccessState("pending", true)).toBe(false);
    expect(isVerifiedLiveSuccessState("rejected", true)).toBe(false);
    expect(isVerifiedLiveSuccessState("unverified", true)).toBe(false);
  });

  it("uses a user-specific localStorage key", () => {
    expect(verifiedBannerStorageKey("user-a")).toBe(
      "paid-talent:verified-banner-dismissed:user-a"
    );
    expect(verifiedBannerStorageKey("user-b")).not.toBe(
      verifiedBannerStorageKey("user-a")
    );
  });
});
