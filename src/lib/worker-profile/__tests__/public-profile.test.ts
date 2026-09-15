import { describe, expect, it } from "vitest";
import {
  mapApprovedPhotosToPublic,
  splitPublicPhotos,
} from "../public-profile";
import type { ProfilePhoto } from "@/lib/db/schema";

function photo(overrides: Partial<ProfilePhoto>): ProfilePhoto {
  return {
    id: "photo-1",
    userId: "user-1",
    workerProfileId: "profile-1",
    stagingKey: null,
    photoKey: "profiles/user-1/a.jpg",
    photoUrl: "https://cdn.example/a.jpg",
    moderationStatus: "approved",
    moderationReason: null,
    moderationConfidence: null,
    moderationCategories: null,
    moderationReviewedAt: null,
    moderationReviewedBy: null,
    displayOrder: 0,
    isCurrentApproved: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("public worker photos", () => {
  it("only maps approved public photos", () => {
    const mapped = mapApprovedPhotosToPublic([
      photo({ id: "ok" }),
      photo({
        id: "pending",
        moderationStatus: "pending",
        photoUrl: null,
        photoKey: null,
        isCurrentApproved: false,
      }),
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].id).toBe("ok");
  });

  it("keeps the primary image obvious and additional photos separate", () => {
    const split = splitPublicPhotos(
      [
        {
          id: "primary",
          photoUrl: "https://cdn.example/primary.jpg",
          displayOrder: 0,
          isCurrentApproved: true,
        },
        {
          id: "extra",
          photoUrl: "https://cdn.example/extra.jpg",
          displayOrder: 1,
          isCurrentApproved: false,
        },
      ],
      null
    );

    expect(split.primaryUrl).toBe("https://cdn.example/primary.jpg");
    expect(split.additional).toHaveLength(1);
    expect(split.additional[0].id).toBe("extra");
  });
});
