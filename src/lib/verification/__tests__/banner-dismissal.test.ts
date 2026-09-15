import { describe, expect, it } from "vitest";
import {
  isVerifiedLiveSuccessState,
  verifiedBannerStorageKey,
} from "../banner-dismissal";

describe("verified banner dismissal", () => {
  it("only treats verified + published as the dismissible success state", () => {
    expect(isVerifiedLiveSuccessState("verified", true, true)).toBe(true);
    expect(isVerifiedLiveSuccessState("verified", true, false)).toBe(false);
    expect(isVerifiedLiveSuccessState("verified", false, true)).toBe(false);
    expect(isVerifiedLiveSuccessState("pending", true, true)).toBe(false);
    expect(isVerifiedLiveSuccessState("rejected", true, true)).toBe(false);
    expect(isVerifiedLiveSuccessState("unverified", true, true)).toBe(false);
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
