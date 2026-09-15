/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROFANITY_BLOCKED_MESSAGE } from "@/lib/helpers/profanity-filter";
import { CONTACT_CIRCUMVENTION_MESSAGE } from "@/lib/profile/public-text";

const mocks = vi.hoisted(() => {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { where, set, update };
});

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveWorker: vi.fn(),
  actionAuthError: vi.fn((result: { error: string }) => ({
    ok: false,
    error: result.error,
  })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: mocks.update,
  },
  workerProfiles: {
    userId: "user_id",
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireActiveWorker } from "@/lib/auth/require-active-user";
import {
  updateProfileBio,
  updateProfileContact,
  updateProfileExperience,
  updateProfileLocation,
  updateProfileName,
  updateProfileRoles,
  updateProfileWorkDetails,
} from "../actions";

const mockedRequireWorker = vi.mocked(requireActiveWorker);

describe("worker profile actions", () => {
  beforeEach(() => {
    mockedRequireWorker.mockReset();
    mockedRequireWorker.mockResolvedValue({
      ok: true,
      user: {
        userId: "worker-1",
        email: "worker@example.com",
        role: "worker",
        ageVerified: true,
      },
    });
    mocks.where.mockClear();
    mocks.set.mockClear();
    mocks.update.mockClear();
  });

  it("rejects profanity and oversize bios on a direct action call", async () => {
    const profanity = await updateProfileBio({ bio: "fuck off cunt" });
    expect(profanity).toEqual({
      success: false,
      error: PROFANITY_BLOCKED_MESSAGE,
    });

    const tooLong = await updateProfileBio({ bio: "A".repeat(501) });
    expect(tooLong.success).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects contact circumvention in public free-text actions", async () => {
    const name = await updateProfileName({ displayName: "LINE: abc123" });
    const experience = await updateProfileExperience({
      experience: "call me 0812345678",
    });
    const location = await updateProfileLocation({
      location: "https://instagram.com/myname",
      availability: ["Full-time"],
    });

    expect(name.error).toBe(CONTACT_CIRCUMVENTION_MESSAGE);
    expect(experience.error).toBe(CONTACT_CIRCUMVENTION_MESSAGE);
    expect(location.error).toBe(CONTACT_CIRCUMVENTION_MESSAGE);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects excessive roles and invalid availability on a direct call", async () => {
    const roles = await updateProfileRoles({
      jobRoles: Array.from({ length: 12 }, (_, index) => `Role ${index}`),
    });
    expect(roles.success).toBe(false);

    const availability = await updateProfileLocation({
      location: "Bangkok",
      availability: ["Full-time", "made-up-value"],
    });
    expect(availability.success).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("still stores designated contact methods", async () => {
    const result = await updateProfileContact({
      lineId: "abc123",
      whatsappNumber: "+66812345678",
      phoneNumber: "0812345678",
    });
    expect(result).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalled();
  });

  it("rejects work-details profanity before writing any fields", async () => {
    const result = await updateProfileWorkDetails({
      jobRoles: ["Bartender", "Dancer"],
      experience: "Five years behind the bar",
      experienceYears: 5,
      languages: ["English", "Thai"],
      bio: "fuck off cunt",
    });
    expect(result).toEqual({
      success: false,
      error: PROFANITY_BLOCKED_MESSAGE,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("defaults missing pay currency to THB and keeps an explicit USD value", async () => {
    const thb = await updateProfileLocation({
      location: "Bangkok",
      availability: ["Flexible"],
    });
    expect(thb.success).toBe(true);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ payCurrency: "THB" })
    );

    const usd = await updateProfileLocation({
      location: "Bangkok",
      availability: ["Flexible"],
      payCurrency: "USD",
    });
    expect(usd.success).toBe(true);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ payCurrency: "USD" })
    );
  });
});
