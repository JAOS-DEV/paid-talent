import { config as loadEnv } from "dotenv";
import { isLocalDatabaseUrl } from "../../src/lib/db/safety";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export function hasLocalAuthEnv(): boolean {
  return (
    isLocalDatabaseUrl(process.env.DATABASE_URL) &&
    process.env.AUTH_DEV_BYPASS === "true"
  );
}

export const LOCAL_AUTH_SKIP_REASON =
  "Requires localhost DATABASE_URL + AUTH_DEV_BYPASS=true with seeded accounts. Use npm run test:e2e:local.";
