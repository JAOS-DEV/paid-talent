import { describe, expect, it } from "vitest";
import { parseVenueLink } from "@/lib/venues/link";
import { SEED_VENUE_LINK_FIXTURES } from "@/lib/db/seed-media";
import { resolveRecruiterAccess } from "@/lib/recruiter-access";

describe("seed venue link fixtures", () => {
  it("all seed venue URLs pass parseVenueLink", () => {
    for (const url of SEED_VENUE_LINK_FIXTURES) {
      const parsed = parseVenueLink(url);
      expect(parsed.ok, url).toBe(true);
      if (parsed.ok) {
        expect(parsed.normalizedUrl).toMatch(/^https:\/\//);
        expect(["google_maps", "facebook", "instagram"]).toContain(parsed.kind);
      }
    }
  });
});

describe("seed expected recruiter tiers (pure)", () => {
  const baseEntitlement = {
    paidAccess: false,
    adminGrantAccess: false,
    passAccess: false,
    billingAccessMode: "enforced" as const,
  };

  it("maps fixture states to expected tiers", () => {
    const cases: Array<{
      label: string;
      expected: "unverified" | "free" | "pro";
      input: Parameters<typeof resolveRecruiterAccess>[0];
    }> = [
      {
        label: "unverified identity",
        expected: "unverified",
        input: {
          userId: "u1",
          accountStatus: "active",
          recruiterProfileId: "rp1",
          identityStatus: "unverified",
          verifiedAt: null,
          venues: [
            {
              id: "v1",
              reviewStatus: "pending",
              archivedAt: null,
              isPrimary: true,
            },
          ],
          entitlement: baseEntitlement,
        },
      },
      {
        label: "free verified",
        expected: "free",
        input: {
          userId: "u2",
          accountStatus: "active",
          recruiterProfileId: "rp2",
          identityStatus: "verified",
          verifiedAt: new Date("2026-01-01"),
          venues: [
            {
              id: "v2",
              reviewStatus: "approved",
              archivedAt: null,
              isPrimary: true,
            },
          ],
          entitlement: baseEntitlement,
        },
      },
      {
        label: "pro via subscription",
        expected: "pro",
        input: {
          userId: "u3",
          accountStatus: "active",
          recruiterProfileId: "rp3",
          identityStatus: "verified",
          verifiedAt: new Date("2026-01-01"),
          venues: [
            {
              id: "v3",
              reviewStatus: "approved",
              archivedAt: null,
              isPrimary: true,
            },
          ],
          entitlement: { ...baseEntitlement, paidAccess: true },
        },
      },
      {
        label: "pro via pass",
        expected: "pro",
        input: {
          userId: "u4",
          accountStatus: "active",
          recruiterProfileId: "rp4",
          identityStatus: "verified",
          verifiedAt: new Date("2026-01-01"),
          venues: [
            {
              id: "v4",
              reviewStatus: "approved",
              archivedAt: null,
              isPrimary: true,
            },
          ],
          entitlement: { ...baseEntitlement, passAccess: true },
        },
      },
      {
        label: "pro via admin grant",
        expected: "pro",
        input: {
          userId: "u5",
          accountStatus: "active",
          recruiterProfileId: "rp5",
          identityStatus: "verified",
          verifiedAt: new Date("2026-01-01"),
          venues: [
            {
              id: "v5",
              reviewStatus: "approved",
              archivedAt: null,
              isPrimary: true,
            },
          ],
          entitlement: { ...baseEntitlement, adminGrantAccess: true },
        },
      },
    ];

    for (const testCase of cases) {
      const access = resolveRecruiterAccess(testCase.input);
      expect(access.tier, testCase.label).toBe(testCase.expected);
    }
  });
});
