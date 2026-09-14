const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export type DatabaseUrlFailureReason =
  | "missing"
  | "malformed"
  | "ambiguous"
  | "remote"
  | "unexpected_database";

export interface ParsedDatabaseUrl {
  protocol: string;
  host: string;
  port: string;
  database: string;
  local: boolean;
}

export interface DatabaseUrlParseError {
  ok: false;
  reason: Exclude<DatabaseUrlFailureReason, "remote" | "unexpected_database">;
  message: string;
}

export interface DatabaseUrlParseSuccess {
  ok: true;
  parsed: ParsedDatabaseUrl;
}

export type DatabaseUrlParseResult = DatabaseUrlParseSuccess | DatabaseUrlParseError;

export interface AssertLocalDatabaseOptions {
  action?: string;
  expectedDatabase?: string;
}

function actionLabel(action: string | undefined): string {
  return action?.trim() ? action.trim() : "this database operation";
}

function safeError(message: string): Error {
  return new Error(message);
}

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
}

function databaseFromPathname(pathname: string): string {
  return pathname.replace(/^\/+/, "").split("/")[0] ?? "";
}

export function parseDatabaseUrl(
  url: string | undefined | null
): DatabaseUrlParseResult {
  if (url == null || url.trim() === "") {
    return {
      ok: false,
      reason: "missing",
      message: "DATABASE_URL is not set.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      reason: "malformed",
      message: "DATABASE_URL is malformed.",
    };
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
    return {
      ok: false,
      reason: "malformed",
      message: "DATABASE_URL must use the postgres or postgresql protocol.",
    };
  }

  const host = normalizeHost(parsed.hostname);
  if (!host) {
    return {
      ok: false,
      reason: "ambiguous",
      message: "DATABASE_URL host is missing or ambiguous.",
    };
  }

  const database = databaseFromPathname(parsed.pathname);
  if (!database) {
    return {
      ok: false,
      reason: "ambiguous",
      message: "DATABASE_URL database name is missing or ambiguous.",
    };
  }

  return {
    ok: true,
    parsed: {
      protocol: parsed.protocol.toLowerCase(),
      host,
      port: parsed.port,
      database,
      local: LOCAL_HOSTS.has(host),
    },
  };
}

export function isLocalDatabaseUrl(url: string | undefined | null): boolean {
  const result = parseDatabaseUrl(url);
  return result.ok && result.parsed.local;
}

export function describeDatabaseTarget(url: string | undefined | null): string {
  const result = parseDatabaseUrl(url);
  if (!result.ok) {
    return result.reason;
  }
  const portSuffix = result.parsed.port ? `:${result.parsed.port}` : "";
  const location = result.parsed.local ? "local" : "remote";
  return `${location} ${result.parsed.host}${portSuffix}/${result.parsed.database}`;
}

export function assertLocalDatabase(
  url: string | undefined | null,
  options: AssertLocalDatabaseOptions = {}
): ParsedDatabaseUrl {
  const action = actionLabel(options.action);
  const result = parseDatabaseUrl(url);

  if (!result.ok) {
    if (result.reason === "missing") {
      throw safeError(`Refusing to ${action} because DATABASE_URL is not set.`);
    }
    if (result.reason === "malformed") {
      throw safeError(`Refusing to ${action} because DATABASE_URL is malformed.`);
    }
    throw safeError(
      `Refusing to ${action} because DATABASE_URL is ambiguous.`
    );
  }

  if (!result.parsed.local) {
    throw safeError(
      `Refusing to ${action} because DATABASE_URL is not local.`
    );
  }

  if (
    options.expectedDatabase &&
    result.parsed.database !== options.expectedDatabase
  ) {
    throw safeError(
      `Refusing to ${action} because DATABASE_URL does not target ${options.expectedDatabase}.`
    );
  }

  return result.parsed;
}

export function requireLocalDatabaseUrl(
  url: string | undefined | null,
  options: AssertLocalDatabaseOptions = {}
): string {
  assertLocalDatabase(url, options);
  if (!url) {
    throw safeError(
      `Refusing to ${actionLabel(options.action)} because DATABASE_URL is not set.`
    );
  }
  return url;
}
