import postgres from "postgres";
import { assertLocalDatabase } from "./safety";

export async function resetLocalPublicSchema(
  url: string,
  expectedDatabase: string
): Promise<void> {
  assertLocalDatabase(url, { action: "reset database", expectedDatabase });

  const client = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    // Drizzle records applied migrations in the `drizzle` schema. Dropping only
    // `public` would leave an empty database that migrate() treats as up to date.
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.unsafe("CREATE SCHEMA public");
    await client.unsafe("GRANT ALL ON SCHEMA public TO CURRENT_USER");
    await client.unsafe("GRANT ALL ON SCHEMA public TO public");
  } finally {
    await client.end({ timeout: 5 });
  }
}
