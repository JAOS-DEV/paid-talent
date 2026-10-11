import { describe, expect, it, beforeEach } from "vitest";
import {
  readWhatHappensNextDismissed,
  shouldShowWhatHappensNext,
  whatHappensNextStorageKey,
  workerHasPublishedContact,
  writeWhatHappensNextDismissed,
} from "../what-happens-next-dismissal";

describe("what happens next dismissal", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses a user-specific localStorage key", () => {
    expect(whatHappensNextStorageKey("user-a")).toBe(
      "paid-talent:what-happens-next-dismissed:user-a"
    );
    expect(whatHappensNextStorageKey("user-b")).not.toBe(
      whatHappensNextStorageKey("user-a")
    );
  });

  it("shows the card when the user has not dismissed it", () => {
    expect(shouldShowWhatHappensNext("worker-1", false)).toBe(true);
    expect(shouldShowWhatHappensNext("worker-1", true)).toBe(false);
    expect(shouldShowWhatHappensNext(undefined, false)).toBe(false);
    expect(shouldShowWhatHappensNext(null, false)).toBe(false);
    expect(shouldShowWhatHappensNext("", false)).toBe(false);
  });

  it("reads and writes dismissal per user", () => {
    expect(readWhatHappensNextDismissed("worker-1")).toBe(false);

    writeWhatHappensNextDismissed("worker-1");

    expect(readWhatHappensNextDismissed("worker-1")).toBe(true);
    expect(readWhatHappensNextDismissed("worker-2")).toBe(false);
    expect(
      window.localStorage.getItem(
        "paid-talent:what-happens-next-dismissed:worker-1"
      )
    ).toBe("1");
  });

  it("detects published contact methods", () => {
    expect(workerHasPublishedContact(null)).toBe(false);
    expect(
      workerHasPublishedContact({
        lineId: null,
        whatsappNumber: null,
        phoneNumber: null,
      })
    ).toBe(false);
    expect(
      workerHasPublishedContact({
        lineId: "  ",
        whatsappNumber: null,
        phoneNumber: null,
      })
    ).toBe(false);
    expect(
      workerHasPublishedContact({
        lineId: "alice",
        whatsappNumber: null,
        phoneNumber: null,
      })
    ).toBe(true);
    expect(
      workerHasPublishedContact({
        lineId: null,
        whatsappNumber: "+66123456789",
        phoneNumber: null,
      })
    ).toBe(true);
  });
});
