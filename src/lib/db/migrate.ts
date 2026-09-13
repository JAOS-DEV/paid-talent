import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import "dotenv/config";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  console.log("Running migrations...");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("Migrations completed successfully");

  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
