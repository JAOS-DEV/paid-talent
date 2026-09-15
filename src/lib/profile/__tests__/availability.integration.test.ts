/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { localDatabaseUrl } from "../../db/local-config";
import { resetLocalPublicSchema } from "../../db/reset-schema";
import { parseDatabaseUrl } from "../../db/safety";
import { migrateLocalDb, startLocalDb } from "../../../../scripts/local-db";

const shouldRun = process.env.RUN_DOCKER_DB_TESTS === "1";

const CONVERSION_SQL = `
  CASE
    WHEN availability IS NULL THEN '[]'::jsonb
    WHEN btrim(availability::text) = '' THEN '[]'::jsonb
    ELSE jsonb_build_array(btrim(availability::text))
  END
`;

const EXPECTED_TABLES = [
  "accounts",
  "admin_audit_events",
  "admin_entitlements",
  "banned_identities",
  "hire_outcome_confirmation_requests",
  "hire_outcomes",
  "platform_settings",
  "profile_interests",
  "profile_photos",
  "profile_views",
  "recruiter_openings",
  "recruiter_profiles",
  "sessions",
  "subscriptions",
  "users",
  "verification_events",
  "verification_tokens",
  "worker_profiles",
] as const;

const EXPECTED_MIGRATIONS = [
  "0000_sticky_invisible_woman",
  "0001_chilly_big_bertha",
  "0002_late_texas_twister",
  "0003_known_firelord",
  "0004_parallel_bulldozer",
  "0005_profile-photo-staging",
  "0006_smooth_overlord",
  "0007_rare_daimon_hellstrom",
] as const;

describe.skipIf(!shouldRun)("worker availability jsonb migration on paid_talent_test", () => {
  it("migrates an empty paid_talent_test through 0000-0007", async () => {
    const testUrl = localDatabaseUrl("test");
    const parsed = parseDatabaseUrl(testUrl);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.parsed.database).toBe("paid_talent_test");
      expect(parsed.parsed.host).toBe("127.0.0.1");
      expect(parsed.parsed.port).toBe("55441");
    }

    await startLocalDb("test");
    await resetLocalPublicSchema(testUrl, "paid_talent_test");
    await migrateLocalDb("test");

    const client = postgres(testUrl, {
      max: 1,
      connect_timeout: 8,
      onnotice: () => undefined,
    });

    try {
      const applied = await client<{ id: number }[]>`
        SELECT id FROM drizzle.__drizzle_migrations ORDER BY created_at, id
      `;
      expect(applied).toHaveLength(EXPECTED_MIGRATIONS.length);

      const tables = await client<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      const tableNames = tables.map((row) => row.table_name);
      for (const table of EXPECTED_TABLES) {
        expect(tableNames, table).toContain(table);
      }

      const availability = await client<
        {
          data_type: string;
          udt_name: string;
          is_nullable: string;
          column_default: string | null;
        }[]
      >`
        SELECT data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'worker_profiles'
          AND column_name = 'availability'
      `;
      expect(availability[0]?.data_type).toBe("jsonb");
      expect(availability[0]?.udt_name).toBe("jsonb");
      expect(availability[0]?.is_nullable).toBe("NO");
      expect(availability[0]?.column_default).toContain("[]");

      const payCurrency = await client<{ column_default: string | null }[]>`
        SELECT column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'worker_profiles'
          AND column_name = 'pay_currency'
      `;
      expect(payCurrency[0]?.column_default).toContain("THB");

      const rowCount = await client<{ count: string }[]>`
        SELECT count(*)::text AS count FROM worker_profiles
      `;
      expect(rowCount[0]?.count).toBe("0");
    } finally {
      await client.end({ timeout: 5 });
    }
  }, 120000);

  it("converts representative scalar availability values", async () => {
    const testUrl = localDatabaseUrl("test");
    const parsed = parseDatabaseUrl(testUrl);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.parsed.database).toBe("paid_talent_test");
    }

    await startLocalDb("test");

    const client = postgres(testUrl, {
      max: 1,
      connect_timeout: 8,
      onnotice: () => undefined,
    });

    try {
      await client.unsafe(`
        CREATE TEMP TABLE availability_migration_probe (
          availability text
        )
      `);
      await client.unsafe(`
        INSERT INTO availability_migration_probe (availability)
        VALUES (NULL), (''), ('Full-time'), ('Part-time')
      `);
      await client.unsafe(`
        ALTER TABLE availability_migration_probe
        ALTER COLUMN availability TYPE jsonb
        USING (${CONVERSION_SQL})
      `);

      const converted = await client<{ availability: unknown }[]>`
        SELECT availability FROM availability_migration_probe
      `;
      expect(converted.map((row) => row.availability)).toEqual([
        [],
        [],
        ["Full-time"],
        ["Part-time"],
      ]);
    } finally {
      await client.end({ timeout: 5 });
    }
  }, 120000);
});
