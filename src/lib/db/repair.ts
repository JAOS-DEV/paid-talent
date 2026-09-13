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
  console.log("\nThis tool fixes migration issues for databases that were");
  console.log("seeded before the verification schema was added.\n");
  console.log("It is safe to run multiple times (idempotent).\n");

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

    console.log("\n🔨 Phase 1: Ensuring verification types exist...");
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "public"."verification_decision" AS ENUM('pending_submitted', 'approved', 'rejected', 'revoked');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "public"."verification_method" AS ENUM('manual_id_review', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "public"."doc_type" AS ENUM('passport', 'thai_id', 'drivers_license', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    console.log("✓ Verification types ready");

    console.log("\n🔨 Phase 2: Adding verification columns to worker_profiles...");
    console.log("   (Must happen BEFORE indexes that reference these columns)");

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "worker_profiles" ADD COLUMN "verification_status" "verification_status" DEFAULT 'unverified' NOT NULL;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "worker_profiles" ADD COLUMN "id_document_key" text;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "worker_profiles" ADD COLUMN "liveness_video_key" text;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "worker_profiles" ADD COLUMN "challenge_code" text;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "worker_profiles" ADD COLUMN "challenge_issued_at" timestamp;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "worker_profiles" ADD COLUMN "id_document_submitted_at" timestamp;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "worker_profiles" ADD COLUMN "verification_reviewed_at" timestamp;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "worker_profiles" ADD COLUMN "verification_reviewed_by" text;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$
    `);
    console.log("✓ Verification columns ready");

    console.log("\n🔨 Phase 3: Creating verification_events table if missing...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "verification_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "worker_profile_id" uuid,
        "decision" "verification_decision" NOT NULL,
        "actor_user_id" uuid,
        "actor_type" text DEFAULT 'admin' NOT NULL,
        "method" "verification_method" NOT NULL,
        "doc_type" "doc_type",
        "id_document_key" text,
        "id_document_sha256" text,
        "liveness_video_key" text,
        "liveness_video_sha256" text,
        "challenge_code" text,
        "last4" text,
        "issuing_country" text,
        "notes" text,
        "retention_expires_at" timestamp,
        "id_document_deleted_at" timestamp,
        "liveness_video_deleted_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log("✓ verification_events table ready");

    console.log("\n🔨 Phase 4: Creating verification indexes...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "worker_profiles_verification_status_idx" 
      ON "worker_profiles" USING btree ("verification_status")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "verification_events_user_id_idx" 
      ON "verification_events" USING btree ("user_id")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "verification_events_worker_profile_id_idx" 
      ON "verification_events" USING btree ("worker_profile_id")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "verification_events_decision_idx" 
      ON "verification_events" USING btree ("decision")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "verification_events_created_at_idx" 
      ON "verification_events" USING btree ("created_at")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "verification_events_retention_expires_idx" 
      ON "verification_events" USING btree ("retention_expires_at")
    `);
    console.log("✓ Verification indexes ready");

    console.log("\n🔨 Phase 5: Adding foreign keys to verification_events...");
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_worker_profile_id_worker_profiles_id_fk" 
        FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE set null ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_actor_user_id_users_id_fk" 
        FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    console.log("✓ Foreign keys ready");

    console.log("\n🔨 Phase 6: Syncing migration journal...");
    const journalCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      ) as exists
    `);

    const journalExists = journalCheck[0]?.exists === true;

    if (!journalExists) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `);
      console.log("✓ Created migration journal table");
    }

    const migrations = await db.execute<MigrationRow>(sql`
      SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY id
    `);

    const hasBaseline = migrations.some((m) => m.hash === MIGRATION_HASH);

    if (!hasBaseline) {
      await db.execute(sql`
        INSERT INTO "__drizzle_migrations" (hash, created_at) 
        VALUES (${MIGRATION_HASH}, ${MIGRATION_TIMESTAMP})
      `);
      console.log("✓ Recorded baseline migration in journal");
    } else {
      console.log("✓ Baseline migration already in journal");
    }

    console.log("\n🔨 Phase 7: Running drizzle migrate for any remaining changes...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✓ Migration complete");

    console.log("\n" + "=".repeat(60));
    console.log("🎉 REPAIR COMPLETE!");
    console.log("=".repeat(60));
    console.log("\nYour database is now up to date with verification schema.");
    console.log("\nNext steps:");
    console.log("  1. Run 'npm run db:seed' to refresh sample data (optional)");
    console.log("  2. Start the dev server: 'npm run dev'");
    console.log("");
  } catch (error) {
    console.error("\n❌ Repair failed:", error);
    console.error("\n💡 This tool is re-runnable. Try running it again.");
    console.error("   If the error persists, check the error message above.");
    console.error("\n💣 Nuclear option (last resort):");
    console.error("   1. Reset your Neon database (or DROP all tables locally)");
    console.error("   2. Run 'npm run db:migrate'");
    console.error("   3. Run 'npm run db:seed'");
    process.exit(1);
  } finally {
    await client.end();
  }
}

repair();
