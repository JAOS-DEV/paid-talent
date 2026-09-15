/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { localDatabaseUrl } from "../../db/local-config";
import { parseDatabaseUrl } from "../../db/safety";
import { migrateLocalDb, startLocalDb } from "../../../../scripts/local-db";

const shouldRun = process.env.RUN_DOCKER_DB_TESTS === "1";

const CONVERSION_SQL = `
  CASE
    WHEN availability IS NULL THEN '[]'::jsonb
    WHEN btrim(availability::text) = '' THEN '[]'::jsonb
    WHEN left(btrim(availability::text), 1) = '[' THEN availability::jsonb
    ELSE jsonb_build_array(availability::text)
  END
`;

describe.skipIf(!shouldRun)("worker availability jsonb migration on paid_talent_test", () => {
  it("converts scalar availability and defaults new workers to THB", async () => {
    const testUrl = localDatabaseUrl("test");
    const parsed = parseDatabaseUrl(testUrl);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.parsed.database).toBe("paid_talent_test");
      expect(parsed.parsed.host).toBe("127.0.0.1");
      expect(parsed.parsed.port).toBe("55441");
    }

    await startLocalDb("test");
    await migrateLocalDb("test");

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
        VALUES (NULL), (''), ('Full-time')
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
      ]);

      const column = await client<{ data_type: string; column_default: string | null }[]>`
        SELECT data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'worker_profiles' AND column_name = 'availability'
      `;
      expect(column[0]?.data_type).toBe("jsonb");
      expect(column[0]?.column_default).toContain("[]");

      const payDefault = await client<{ column_default: string | null }[]>`
        SELECT column_default
        FROM information_schema.columns
        WHERE table_name = 'worker_profiles' AND column_name = 'pay_currency'
      `;
      expect(payDefault[0]?.column_default).toContain("THB");

      const seeded = await client<{ availability: unknown; pay_currency: string | null }[]>`
        SELECT wp.availability, wp.pay_currency
        FROM worker_profiles wp
        INNER JOIN users u ON u.id = wp.user_id
        WHERE u.email = 'worker1@example.com'
        LIMIT 1
      `;
      if (seeded[0]) {
        expect(Array.isArray(seeded[0].availability)).toBe(true);
        expect(seeded[0].availability).toContain("Full-time");
      }
    } finally {
      await client.end({ timeout: 5 });
    }
  }, 120000);
});
