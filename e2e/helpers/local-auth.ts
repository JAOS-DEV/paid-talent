import { config as loadEnv } from "dotenv";
import { isAuthenticatedLocalTestEnv } from "../../src/lib/db/e2e-auth-gate";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export function hasLocalAuthEnv(): boolean {
  return isAuthenticatedLocalTestEnv({
    databaseUrl: process.env.DATABASE_URL,
    authDevBypass: process.env.AUTH_DEV_BYPASS,
  });
}

export const LOCAL_AUTH_SKIP_REASON =
  "Requires local paid_talent_test DATABASE_URL + AUTH_DEV_BYPASS=true with seeded accounts. Use npm run test:e2e:local.";
