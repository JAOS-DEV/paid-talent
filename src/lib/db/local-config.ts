export const LOCAL_POSTGRES_IMAGE = "postgres:16-alpine";
export const COMPOSE_PROJECT_NAME = "paid-talent";
export const COMPOSE_FILE_NAME = "docker-compose.yml";

export const LOCAL_DB_USER = "paidtalent";
export const LOCAL_DB_PASSWORD = "paidtalent";

export type LocalDbKind = "dev" | "test";

export interface LocalDbTarget {
  kind: LocalDbKind;
  service: string;
  container: string;
  database: string;
  defaultPort: number;
  volume: string;
}

export const LOCAL_DB_TARGETS: Record<LocalDbKind, LocalDbTarget> = {
  dev: {
    kind: "dev",
    service: "paid-talent-dev-pg",
    container: "paid-talent-dev-pg",
    database: "paid_talent_dev",
    defaultPort: 55440,
    volume: "paid-talent-dev-pg-data",
  },
  test: {
    kind: "test",
    service: "paid-talent-test-pg",
    container: "paid-talent-test-pg",
    database: "paid_talent_test",
    defaultPort: 55441,
    volume: "paid-talent-test-pg-data",
  },
};

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function localDbPort(kind: LocalDbKind): number {
  const target = LOCAL_DB_TARGETS[kind];
  const envName =
    kind === "dev" ? "PAID_TALENT_DEV_DB_PORT" : "PAID_TALENT_TEST_DB_PORT";
  return parsePort(process.env[envName], target.defaultPort);
}

export function localDatabaseUrl(kind: LocalDbKind): string {
  const target = LOCAL_DB_TARGETS[kind];
  const port = localDbPort(kind);
  return `postgresql://${LOCAL_DB_USER}:${LOCAL_DB_PASSWORD}@127.0.0.1:${port}/${target.database}`;
}

export function prDatabaseName(prNumber: number): string {
  return `paid_talent_pr_${prNumber}`;
}

export function prContainerName(prNumber: number): string {
  return `paid-talent-pr${prNumber}-pg`;
}

export function prVolumeName(prNumber: number): string {
  return `paid-talent-pr${prNumber}-pg-data`;
}

export function prDefaultPort(prNumber: number): number {
  return 55500 + prNumber;
}

export function prDatabaseUrl(prNumber: number, port = prDefaultPort(prNumber)): string {
  return `postgresql://${LOCAL_DB_USER}:${LOCAL_DB_PASSWORD}@127.0.0.1:${port}/${prDatabaseName(prNumber)}`;
}
