import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

export * from "./schema";
