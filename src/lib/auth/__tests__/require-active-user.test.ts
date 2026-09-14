import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const getUserAccountAccess = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => auth(...args),
}));

vi.mock("@/lib/auth/account-access", () => ({
  getUserAccountAccess: (...args: unknown[]) => getUserAccountAccess(...args),
}));

import {
  requireActiveAppUser,
  requireActiveRecruiter,
  requireActiveWorker,
} from "../require-active-user";

const workerSession = {
  user: {
    id: "worker-1",
    role: "worker" as const,
    email: "worker@example.com",
    ageVerified: true,
    signupPending: false,
  },
};

const recruiterSession = {
  user: {
    id: "recruiter-1",
    role: "recruiter" as const,
    email: "recruiter@example.com",
    ageVerified: true,
    signupPending: false,
  },
};

describe("requireActiveAppUser", () => {
  beforeEach(() => {
    auth.mockReset();
    getUserAccountAccess.mockReset();
  });

  it("allows an active Worker JWT to continue", async () => {
    auth.mockResolvedValue(workerSession);
    getUserAccountAccess.mockResolvedValue({
      allowed: true,
      reason: null,
      email: "worker@example.com",
    });

    const result = await requireActiveWorker();
    expect(result).toEqual({
      ok: true,
      user: {
        userId: "worker-1",
        email: "worker@example.com",
        role: "worker",
        ageVerified: true,
      },
    });
  });

  it("denies a suspended Worker JWT immediately", async () => {
    auth.mockResolvedValue(workerSession);
    getUserAccountAccess.mockResolvedValue({
      allowed: false,
      reason: "suspended",
      email: "worker@example.com",
    });

    await expect(requireActiveWorker()).resolves.toEqual({
      ok: false,
      status: 403,
      error: "Account restricted",
      reason: "suspended",
    });
  });

  it("denies a banned Recruiter JWT immediately", async () => {
    auth.mockResolvedValue(recruiterSession);
    getUserAccountAccess.mockResolvedValue({
      allowed: false,
      reason: "banned",
      email: "recruiter@example.com",
    });

    await expect(requireActiveRecruiter()).resolves.toEqual({
      ok: false,
      status: 403,
      error: "Account restricted",
      reason: "banned",
    });
  });

  it("does not grant Worker access from Recruiter role spoofing", async () => {
    auth.mockResolvedValue(recruiterSession);
    getUserAccountAccess.mockResolvedValue({
      allowed: true,
      reason: null,
      email: "recruiter@example.com",
    });

    await expect(requireActiveWorker()).resolves.toMatchObject({
      ok: false,
      status: 403,
      reason: "forbidden_role",
    });
    expect(getUserAccountAccess).not.toHaveBeenCalled();
  });

  it("rejects pending signup JWTs before touching account status", async () => {
    auth.mockResolvedValue({
      user: {
        id: "",
        role: "worker",
        signupPending: true,
        ageVerified: false,
      },
    });

    await expect(requireActiveAppUser()).resolves.toMatchObject({
      ok: false,
      status: 401,
      reason: "unauthenticated",
    });
    expect(getUserAccountAccess).not.toHaveBeenCalled();
  });
});
