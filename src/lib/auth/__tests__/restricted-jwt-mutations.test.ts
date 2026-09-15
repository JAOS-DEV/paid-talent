import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

const auth = vi.fn();
const getUserAccountAccess = vi.fn();
const updateWhere = vi.fn();
const updateSet = vi.fn(() => ({ where: updateWhere }));
const dbUpdate = vi.fn(() => ({ set: updateSet }));

vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => auth(...args),
}));

vi.mock("@/lib/auth/account-access", () => ({
  getUserAccountAccess: (...args: unknown[]) => getUserAccountAccess(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: (...args: unknown[]) => dbUpdate(...args),
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
  workerProfiles: { userId: "user_id" },
  recruiterProfiles: { id: "id", userId: "user_id" },
  recruiterOpenings: {
    id: "id",
    recruiterProfileId: "recruiter_profile_id",
  },
}));

import { publishProfile } from "@/app/worker/actions";
import { publishOpening } from "@/lib/recruiter-profile/actions";

const SRC_ROOT = path.join(process.cwd(), "src");

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), "utf8");
}

describe("existing JWT cannot mutate after restriction", () => {
  beforeEach(() => {
    auth.mockReset();
    getUserAccountAccess.mockReset();
    dbUpdate.mockClear();
    updateSet.mockClear();
    updateWhere.mockClear();
  });

  it("blocks Worker publishProfile after suspension", async () => {
    auth.mockResolvedValue({
      user: {
        id: "worker-1",
        role: "worker",
        email: "worker@example.com",
        ageVerified: true,
      },
    });
    getUserAccountAccess.mockResolvedValue({
      allowed: false,
      reason: "suspended",
      email: "worker@example.com",
    });

    await expect(publishProfile()).resolves.toEqual({
      success: false,
      error: "Account restricted",
    });
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it("blocks Worker publishProfile after ban", async () => {
    auth.mockResolvedValue({
      user: {
        id: "worker-1",
        role: "worker",
        email: "worker@example.com",
        ageVerified: true,
      },
    });
    getUserAccountAccess.mockResolvedValue({
      allowed: false,
      reason: "banned",
      email: "worker@example.com",
    });

    await expect(publishProfile()).resolves.toEqual({
      success: false,
      error: "Account restricted",
    });
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it("blocks Recruiter publishOpening after suspension", async () => {
    auth.mockResolvedValue({
      user: {
        id: "recruiter-1",
        role: "recruiter",
        email: "recruiter@example.com",
        ageVerified: true,
      },
    });
    getUserAccountAccess.mockResolvedValue({
      allowed: false,
      reason: "suspended",
      email: "recruiter@example.com",
    });

    await expect(publishOpening("11111111-1111-4111-8111-111111111111")).resolves.toEqual({
      success: false,
      error: "Account restricted",
    });
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it("blocks Recruiter publishOpening after ban", async () => {
    auth.mockResolvedValue({
      user: {
        id: "recruiter-1",
        role: "recruiter",
        email: "recruiter@example.com",
        ageVerified: true,
      },
    });
    getUserAccountAccess.mockResolvedValue({
      allowed: false,
      reason: "banned",
      email: "recruiter@example.com",
    });

    await expect(publishOpening("11111111-1111-4111-8111-111111111111")).resolves.toEqual({
      success: false,
      error: "Account restricted",
    });
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it("lets an active Worker publish", async () => {
    auth.mockResolvedValue({
      user: {
        id: "worker-1",
        role: "worker",
        email: "worker@example.com",
        ageVerified: true,
      },
    });
    getUserAccountAccess.mockResolvedValue({
      allowed: true,
      reason: null,
      email: "worker@example.com",
    });
    updateWhere.mockResolvedValue(undefined);

    await expect(publishProfile()).resolves.toEqual({ success: true });
    expect(dbUpdate).toHaveBeenCalled();
  });
});

describe("active-account guard coverage", () => {
  it("wires Worker and Recruiter mutation surfaces through the shared guard", () => {
    const files = [
      "app/worker/actions.ts",
      "app/worker/hire-confirmation-actions.ts",
      "app/api/worker/hire-confirmations/pending/route.ts",
      "lib/recruiter-profile/actions.ts",
      "app/recruiter/actions.ts",
      "app/api/worker/profile/route.ts",
      "app/api/worker/dashboard/route.ts",
      "app/api/worker/photos/route.ts",
      "app/api/worker/photos/[id]/route.ts",
      "app/api/worker/profile/preview/route.ts",
      "app/api/worker/verification/route.ts",
      "app/api/worker/verification/upload/route.ts",
      "app/api/worker/verification/challenge/route.ts",
      "app/api/media/upload/route.ts",
      "app/api/interests/route.ts",
      "app/api/recruiter/openings/route.ts",
      "app/api/recruiter/interests/route.ts",
      "app/api/recruiter/interests/stats/route.ts",
      "app/api/workers/search/route.ts",
      "app/api/workers/[id]/route.ts",
      "app/api/stripe/checkout/route.ts",
      "app/api/stripe/portal/route.ts",
      "app/api/stripe/status/route.ts",
    ];

    for (const file of files) {
      const source = readSrc(file);
      expect(source).toMatch(
        /requireActiveWorker|requireActiveRecruiter|requireActiveAppUser/
      );
    }
  });

  it("keeps paywall updates conditioned on the previous mode", () => {
    const source = readSrc("lib/platform-settings/index.ts");
    expect(source).toContain("eq(platformSettings.billingAccessMode, input.previousMode)");
  });

  it("keeps account moderation inside a database transaction", () => {
    const source = readSrc("lib/admin/account-moderation.ts");
    expect(source).toContain("db.transaction");
    expect(source).toContain("moderateAccountWithClient");
  });
});
