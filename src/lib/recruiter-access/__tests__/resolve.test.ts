import { describe, expect, it } from "vitest";
import { resolveRecruiterAccess } from "../index";
import type { EffectiveEntitlement } from "@/lib/entitlements";

function entitlement(
  overrides: Partial<
    Pick<
      EffectiveEntitlement,
      "paidAccess" | "adminGrantAccess" | "passAccess" | "billingAccessMode"
    >
  > = {}
): Pick<
  EffectiveEntitlement,
  "paidAccess" | "adminGrantAccess" | "passAccess" | "billingAccessMode"
> {
  return {
    paidAccess: false,
    adminGrantAccess: false,
    passAccess: false,
    billingAccessMode: "enforced",
    ...overrides,
  };
}

const base = {
  userId: "recruiter-1",
  recruiterProfileId: "rp-1",
  identityStatus: "verified" as const,
  verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  accountStatus: "active" as const,
};

describe("resolveRecruiterAccess", () => {
  it("unverified identity → unverified tier", () => {
    const access = resolveRecruiterAccess({
      ...base,
      identityStatus: "unverified",
      venues: [
        {
          id: "v1",
          reviewStatus: "approved",
          archivedAt: null,
          isPrimary: true,
        },
      ],
      entitlement: entitlement(),
    });

    expect(access.tier).toBe("unverified");
    expect(access.isVerified).toBe(false);
    expect(access.canBrowseFull).toBe(false);
    expect(access.canViewTopTalentFull).toBe(false);
  });

  it("verified identity but venue pending → unverified", () => {
    const access = resolveRecruiterAccess({
      ...base,
      venues: [
        {
          id: "v1",
          reviewStatus: "pending",
          archivedAt: null,
          isPrimary: true,
        },
      ],
      entitlement: entitlement(),
    });

    expect(access.tier).toBe("unverified");
    expect(access.isVerified).toBe(false);
    expect(access.hasApprovedVenue).toBe(false);
    expect(access.canBrowseFull).toBe(false);
  });

  it("verified + approved venue → free", () => {
    const access = resolveRecruiterAccess({
      ...base,
      venues: [
        {
          id: "v1",
          reviewStatus: "approved",
          archivedAt: null,
          isPrimary: true,
        },
      ],
      entitlement: entitlement(),
    });

    expect(access.tier).toBe("free");
    expect(access.isVerified).toBe(true);
    expect(access.canBrowseFull).toBe(true);
    expect(access.canViewTopTalentFull).toBe(false);
    expect(access.approvedVenueIds).toEqual(["v1"]);
    expect(access.primaryVenueId).toBe("v1");
  });

  it("verified + paid subscription → pro", () => {
    const access = resolveRecruiterAccess({
      ...base,
      venues: [
        {
          id: "v1",
          reviewStatus: "approved",
          archivedAt: null,
          isPrimary: true,
        },
      ],
      entitlement: entitlement({ paidAccess: true }),
    });

    expect(access.tier).toBe("pro");
    expect(access.canViewTopTalentFull).toBe(true);
  });

  it("verified + admin grant → pro", () => {
    const access = resolveRecruiterAccess({
      ...base,
      venues: [
        {
          id: "v1",
          reviewStatus: "approved",
          archivedAt: null,
          isPrimary: true,
        },
      ],
      entitlement: entitlement({ adminGrantAccess: true }),
    });

    expect(access.tier).toBe("pro");
    expect(access.canViewTopTalentFull).toBe(true);
  });

  it("verified + active 7-day pass → pro", () => {
    const access = resolveRecruiterAccess({
      ...base,
      venues: [
        {
          id: "v1",
          reviewStatus: "approved",
          archivedAt: null,
          isPrimary: true,
        },
      ],
      entitlement: entitlement({ passAccess: true }),
    });

    expect(access.tier).toBe("pro");
    expect(access.canViewTopTalentFull).toBe(true);
  });

  it("open_access + verified → free with canViewTopTalentFull", () => {
    const access = resolveRecruiterAccess({
      ...base,
      venues: [
        {
          id: "v1",
          reviewStatus: "approved",
          archivedAt: null,
          isPrimary: true,
        },
      ],
      entitlement: entitlement({ billingAccessMode: "open_access" }),
    });

    expect(access.tier).toBe("free");
    expect(access.canViewTopTalentFull).toBe(true);
    expect(access.billingAccessMode).toBe("open_access");
  });

  it("open_access + unverified → unverified, canViewTopTalentFull false", () => {
    const access = resolveRecruiterAccess({
      ...base,
      identityStatus: "unverified",
      venues: [],
      entitlement: entitlement({ billingAccessMode: "open_access" }),
    });

    expect(access.tier).toBe("unverified");
    expect(access.canViewTopTalentFull).toBe(false);
  });

  it("suspended account → not verified", () => {
    const access = resolveRecruiterAccess({
      ...base,
      accountStatus: "suspended",
      venues: [
        {
          id: "v1",
          reviewStatus: "approved",
          archivedAt: null,
          isPrimary: true,
        },
      ],
      entitlement: entitlement({ paidAccess: true }),
    });

    expect(access.isVerified).toBe(false);
    expect(access.tier).toBe("unverified");
    expect(access.canBrowseFull).toBe(false);
    expect(access.canViewTopTalentFull).toBe(false);
  });

  it("isPaused is always false for now", () => {
    const access = resolveRecruiterAccess({
      ...base,
      venues: [
        {
          id: "v1",
          reviewStatus: "approved",
          archivedAt: null,
          isPrimary: true,
        },
      ],
      entitlement: entitlement(),
    });
    expect(access.isPaused).toBe(false);
  });
});
