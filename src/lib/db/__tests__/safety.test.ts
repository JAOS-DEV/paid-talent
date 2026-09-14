/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  assertLocalDatabase,
  describeDatabaseTarget,
  isLocalDatabaseUrl,
  parseDatabaseUrl,
} from "../safety";

const SECRET = "super-secret-db-password-xyz";

function expectNoSecret(value: unknown): void {
  const text = value instanceof Error ? `${value.message}\n${value.stack ?? ""}` : String(value);
  expect(text).not.toContain(SECRET);
  expect(text).not.toContain(`:${SECRET}@`);
}

describe("database URL safety", () => {
  it("allows the postgres protocol on localhost", () => {
    const url = `postgres://paidtalent:${SECRET}@localhost:55440/paid_talent_dev`;
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it("allows localhost", () => {
    const url = `postgresql://paidtalent:${SECRET}@localhost:55440/paid_talent_dev`;
    expect(isLocalDatabaseUrl(url)).toBe(true);
    const parsed = assertLocalDatabase(url, { action: "reset database" });
    expect(parsed.host).toBe("localhost");
    expect(parsed.database).toBe("paid_talent_dev");
  });

  it("allows 127.0.0.1", () => {
    const url = `postgresql://paidtalent:${SECRET}@127.0.0.1:55441/paid_talent_test`;
    expect(isLocalDatabaseUrl(url)).toBe(true);
    expect(assertLocalDatabase(url).host).toBe("127.0.0.1");
  });

  it("allows ::1", () => {
    const url = `postgresql://paidtalent:${SECRET}@[::1]:55440/paid_talent_dev`;
    expect(isLocalDatabaseUrl(url)).toBe(true);
    expect(assertLocalDatabase(url).host).toBe("::1");
  });

  it("rejects a Neon hostname for destructive local action", () => {
    const url = `postgresql://user:${SECRET}@ep-example-pooler.us-east-1.aws.neon.tech/neondb`;
    expect(isLocalDatabaseUrl(url)).toBe(false);
    expect(() => assertLocalDatabase(url, { action: "reset database" })).toThrow(
      "Refusing to reset database because DATABASE_URL is not local."
    );
    try {
      assertLocalDatabase(url, { action: "reset database" });
    } catch (error) {
      expectNoSecret(error);
    }
  });

  it("rejects a Supabase hostname", () => {
    const url = `postgresql://postgres:${SECRET}@db.abcdefghijklmnop.supabase.co:5432/postgres`;
    expect(isLocalDatabaseUrl(url)).toBe(false);
    expect(() => assertLocalDatabase(url, { action: "seed database" })).toThrow(
      "Refusing to seed database because DATABASE_URL is not local."
    );
    try {
      assertLocalDatabase(url, { action: "seed database" });
    } catch (error) {
      expectNoSecret(error);
    }
  });

  it("rejects an AWS RDS hostname", () => {
    const url = `postgresql://app:${SECRET}@paid-talent.abc123.us-east-1.rds.amazonaws.com:5432/paid_talent`;
    expect(isLocalDatabaseUrl(url)).toBe(false);
    expect(() => assertLocalDatabase(url, { action: "reset database" })).toThrow(
      /not local/
    );
    try {
      assertLocalDatabase(url, { action: "reset database" });
    } catch (error) {
      expectNoSecret(error);
    }
  });

  it("rejects a malformed URL", () => {
    expect(isLocalDatabaseUrl("not-a-url")).toBe(false);
    expect(() => assertLocalDatabase("not-a-url", { action: "reset database" })).toThrow(
      "Refusing to reset database because DATABASE_URL is malformed."
    );
    const parsed = parseDatabaseUrl(`postgresql://user:${SECRET}@`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expectNoSecret(parsed.message);
    }
  });

  it("rejects a missing URL", () => {
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
    expect(() => assertLocalDatabase(undefined, { action: "reset database" })).toThrow(
      "Refusing to reset database because DATABASE_URL is not set."
    );
  });

  it("rejects an ambiguous host-less postgres URL", () => {
    const url = "postgresql:///dbname";
    expect(() => assertLocalDatabase(url, { action: "reset database" })).toThrow(
      "Refusing to reset database because DATABASE_URL is ambiguous."
    );
  });

  it("rejects a host-less URL with credentials as malformed or ambiguous", () => {
    const url = `postgresql://user:${SECRET}@/dbname`;
    expect(isLocalDatabaseUrl(url)).toBe(false);
    try {
      assertLocalDatabase(url, { action: "reset database" });
      throw new Error("expected refusal");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/malformed|ambiguous|not set/);
      expectNoSecret(error);
    }
  });

  it("rejects the wrong local database name for a targeted reset", () => {
    const url = `postgresql://paidtalent:${SECRET}@127.0.0.1:55440/paid_talent_dev`;
    expect(() =>
      assertLocalDatabase(url, {
        action: "reset database",
        expectedDatabase: "paid_talent_test",
      })
    ).toThrow(
      "Refusing to reset database because DATABASE_URL does not target paid_talent_test."
    );
  });

  it("never includes secrets in describeDatabaseTarget output", () => {
    const remote = `postgresql://user:${SECRET}@ep-example.aws.neon.tech/neondb?sslmode=require`;
    const described = describeDatabaseTarget(remote);
    expect(described).toContain("remote");
    expect(described).toContain("ep-example.aws.neon.tech");
    expectNoSecret(described);
    expect(described).not.toContain("postgresql://");
  });
});
