import { describe, expect, it } from "vitest";
import {
  buildPhotoSlots,
  emptyDashboardStats,
  profileViewWindowStart,
  toDashboardStats,
  toSlotCount,
} from "../index";

describe("worker dashboard metrics helpers", () => {
  it("uses a 30-day profile view window", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const start = profileViewWindowStart(now);
    expect(start.toISOString()).toBe("2026-08-16T12:00:00.000Z");
  });

  it("displays unique recruiter viewers as the primary profile-views metric", () => {
    const stats = toDashboardStats(
      {
        windowDays: 30,
        viewEventsLast30Days: 9,
        uniqueRecruiterViewersLast30Days: 3,
      },
      2
    );

    expect(stats.profileViewsLast30Days).toBe(3);
    expect(stats.profileViewEventsLast30Days).toBe(9);
    expect(stats.interestReceivedCount).toBe(2);
  });

  it("does not count rejected photos toward gallery slots", () => {
    expect(toSlotCount(2, 1)).toBe(3);
    const slots = buildPhotoSlots({
      approvedCount: 2,
      pendingCount: 1,
      isVerified: true,
    });
    expect(slots.slotCount).toBe(3);
    expect(slots.remainingSlots).toBe(2);
    expect(slots.canAddGalleryPhoto).toBe(false);
  });

  it("starts empty stats at zero instead of fabricating counts", () => {
    expect(emptyDashboardStats()).toEqual({
      profileViewsLast30Days: 0,
      profileViewEventsLast30Days: 0,
      uniqueRecruiterViewersLast30Days: 0,
      interestReceivedCount: 0,
    });
  });
});
