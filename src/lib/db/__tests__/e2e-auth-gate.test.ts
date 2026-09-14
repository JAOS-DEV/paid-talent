/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { isAuthenticatedLocalTestEnv } from "../e2e-auth-gate";

const SECRET = "super-secret-db-password-xyz";
const TEST_URL = `postgresql://paidtalent:${SECRET}@127.0.0.1:55441/paid_talent_test`;
const DEV_URL = `postgresql://paidtalent:${SECRET}@127.0.0.1:55440/paid_talent_dev`;

function expectNoSecret(value: boolean): void {
  expect(String(value)).not.toContain(SECRET);
}

describe("authenticated local E2E gate", () => {
  it("allows paid_talent_test on localhost with AUTH_DEV_BYPASS=true", () => {
    const allowed = isAuthenticatedLocalTestEnv({
      databaseUrl: TEST_URL,
      authDevBypass: "true",
    });
    expect(allowed).toBe(true);
    expectNoSecret(allowed);
  });

  it("allows paid_talent_test on ::1 with AUTH_DEV_BYPASS=true", () => {
    expect(
      isAuthenticatedLocalTestEnv({
        databaseUrl: `postgresql://paidtalent:${SECRET}@[::1]:55441/paid_talent_test`,
        authDevBypass: "true",
      })
    ).toBe(true);
  });

  it("does not allow paid_talent_dev on localhost even with AUTH_DEV_BYPASS=true", () => {
    expect(
      isAuthenticatedLocalTestEnv({
        databaseUrl: DEV_URL,
        authDevBypass: "true",
      })
    ).toBe(false);
  });

  it("does not allow an arbitrary other localhost database", () => {
    expect(
      isAuthenticatedLocalTestEnv({
        databaseUrl: `postgresql://paidtalent:${SECRET}@localhost:55442/paid_talent_pr_42`,
        authDevBypass: "true",
      })
    ).toBe(false);
  });

  it("does not allow a remote Neon DATABASE_URL", () => {
    expect(
      isAuthenticatedLocalTestEnv({
        databaseUrl: `postgresql://user:${SECRET}@ep-example-pooler.us-east-1.aws.neon.tech/neondb`,
        authDevBypass: "true",
      })
    ).toBe(false);
  });

  it("does not allow a missing DATABASE_URL", () => {
    expect(
      isAuthenticatedLocalTestEnv({
        databaseUrl: undefined,
        authDevBypass: "true",
      })
    ).toBe(false);
  });

  it("does not allow a malformed DATABASE_URL", () => {
    expect(
      isAuthenticatedLocalTestEnv({
        databaseUrl: "not-a-url",
        authDevBypass: "true",
      })
    ).toBe(false);
  });

  it("does not allow AUTH_DEV_BYPASS to be absent", () => {
    expect(
      isAuthenticatedLocalTestEnv({
        databaseUrl: TEST_URL,
        authDevBypass: undefined,
      })
    ).toBe(false);
  });

  it("does not allow AUTH_DEV_BYPASS=false", () => {
    expect(
      isAuthenticatedLocalTestEnv({
        databaseUrl: TEST_URL,
        authDevBypass: "false",
      })
    ).toBe(false);
  });
});
