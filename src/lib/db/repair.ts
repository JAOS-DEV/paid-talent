import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const MIGRATION_HASH = "0000_sticky_invisible_woman";
const MIGRATION_TIMESTAMP = 1789318340493;

interface MigrationRow {
  id: number;
  hash: string;
  created_at: string;
}

async function repair(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🔧 Database Repair Tool");
  console.log("=".repeat(60));
  console.log("\nThis tool fixes the 'type already exists' migration error for");
  console.log("databases that were seeded before the verification schema (#11).\n");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    const tableCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      ) as exists
    `);

    const usersTableExists = tableCheck[0]?.exists === true;

    if (!usersTableExists) {
      console.log("ℹ️  Database appears empty (no 'users' table found).");
      console.log("   Running standard migration...\n");
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("\n✅ Fresh database setup complete!");
      await client.end();
      process.exit(0);
    }

    console.log("✓ Found existing 'users' table (DB was previously seeded)");

    const journalCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      ) as exists
    `);

    const journalExists = journalCheck[0]?.exists === true;

    if (!journalExists) {
      console.log("✗ Migration journal table '__drizzle_migrations' not found");
      console.log("\n🔨 Creating migration journal and recording baseline...\n");

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `);

      await db.execute(sql`
        INSERT INTO "__drizzle_migrations" (hash, created_at) 
        VALUES (${MIGRATION_HASH}, ${MIGRATION_TIMESTAMP})
      `);

      console.log("✅ Migration journal created and baseline recorded");
    } else {
      console.log("✓ Migration journal table exists");

      const migrations = await db.execute<MigrationRow>(sql`
        SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY id
      `);

      const hasBaseline = migrations.some((m) => m.hash === MIGRATION_HASH);

      if (hasBaseline) {
        console.log("✓ Baseline migration already recorded");
      } else {
        console.log("✗ Baseline migration not recorded in journal");
        console.log("\n🔨 Recording baseline migration...\n");

        await db.execute(sql`
          INSERT INTO "__drizzle_migrations" (hash, created_at) 
          VALUES (${MIGRATION_HASH}, ${MIGRATION_TIMESTAMP})
        `);

        console.log("✅ Baseline migration recorded");
      }
    }

    const verificationColumnCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'worker_profiles'
        AND column_name = 'verification_status'
      ) as exists
    `);

    const hasVerificationStatus = verificationColumnCheck[0]?.exists === true;

    if (hasVerificationStatus) {
      console.log("✓ Verification columns already present");
      console.log("\n✅ Database is up to date! No action needed.\n");
    } else {
      console.log("✗ Verification columns missing from worker_profiles");
      console.log("\n🔨 Running migration to add verification columns...\n");

      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("\n✅ Verification columns added successfully!");
    }

    console.log("=".repeat(60));
    console.log("🎉 Repair complete! Your database is now up to date.");
    console.log("\nNext steps:");
    console.log("  1. Run 'npm run db:seed' to refresh sample data (optional)");
    console.log("  2. Start the dev server: 'npm run dev'");
    console.log("");
  } catch (error) {
    console.error("\n❌ Repair failed:", error);
    console.error("\n💡 If this error persists, try the nuclear option:");
    console.error("   1. Reset your Neon database (or DROP all tables locally)");
    console.error("   2. Run 'npm run db:migrate'");
    console.error("   3. Run 'npm run db:seed'");
    process.exit(1);
  } finally {
    await client.end();
  }
}

repair();
