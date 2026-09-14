import { LOCAL_DB_TARGETS } from "./local-config";
import { parseDatabaseUrl } from "./safety";

export interface AuthenticatedLocalE2EEnv {
  databaseUrl?: string | null;
  authDevBypass?: string | null;
}

export function isAuthenticatedLocalTestEnv(
  env: AuthenticatedLocalE2EEnv
): boolean {
  if (env.authDevBypass !== "true") {
    return false;
  }

  const parsed = parseDatabaseUrl(env.databaseUrl);
  return (
    parsed.ok &&
    parsed.parsed.local &&
    parsed.parsed.database === LOCAL_DB_TARGETS.test.database
  );
}
