import { spawn, type SpawnOptions } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  COMPOSE_FILE_NAME,
  COMPOSE_PROJECT_NAME,
  LOCAL_DB_PASSWORD,
  LOCAL_DB_TARGETS,
  LOCAL_DB_USER,
  LOCAL_POSTGRES_IMAGE,
  localDatabaseUrl,
  type LocalDbKind,
  prContainerName,
  prDatabaseName,
  prDatabaseUrl,
  prDefaultPort,
  prVolumeName,
} from "../src/lib/db/local-config";
import { resetLocalPublicSchema } from "../src/lib/db/reset-schema";
import { assertLocalDatabase, describeDatabaseTarget } from "../src/lib/db/safety";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptsDir, "..");
const composeFile = path.join(repoRoot, COMPOSE_FILE_NAME);
const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

const DOCKER_STOPPED_MESSAGE =
  "If Docker Desktop is stopped, local DB commands will fail until Docker is started.";

function printSafeError(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(message);
}

function runCommand(
  command: string,
  args: string[],
  options: SpawnOptions = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      windowsHide: true,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function runCommandCapture(
  command: string,
  args: string[],
  options: SpawnOptions = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function ensureDocker(): Promise<void> {
  try {
    const result = await runCommandCapture("docker", ["info"]);
    if (result.code !== 0) {
      throw new Error(
        `Docker is not available. ${DOCKER_STOPPED_MESSAGE}`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Docker is not available")) {
      throw error;
    }
    throw new Error(`Docker is not available. ${DOCKER_STOPPED_MESSAGE}`);
  }
}

function composeArgs(extra: string[]): string[] {
  return [
    "compose",
    "-p",
    COMPOSE_PROJECT_NAME,
    "-f",
    composeFile,
    ...extra,
  ];
}

function parseKind(value: string | undefined, fallback: LocalDbKind | "all"): LocalDbKind | "all" {
  if (!value) return fallback;
  if (value === "dev" || value === "test" || value === "all") return value;
  throw new Error(`Unknown database target "${value}". Use dev, test, or all.`);
}

function kindsFrom(target: LocalDbKind | "all"): LocalDbKind[] {
  return target === "all" ? ["dev", "test"] : [target];
}

async function waitForHealthy(kind: LocalDbKind, timeoutMs = 120000): Promise<void> {
  const container = LOCAL_DB_TARGETS[kind].container;
  const started = Date.now();
  let lastStatus = "unknown";

  while (Date.now() - started < timeoutMs) {
    const inspect = await runCommandCapture("docker", [
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      container,
    ]);
    lastStatus = inspect.stdout.trim() || inspect.stderr.trim() || "unknown";
    if (inspect.code === 0 && lastStatus === "healthy") {
      await assertCanConnect(localDatabaseUrl(kind), LOCAL_DB_TARGETS[kind].database);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `Timed out waiting for ${container} to become healthy (last status: ${lastStatus}). ${DOCKER_STOPPED_MESSAGE}`
  );
}

async function assertCanConnect(url: string, expectedDatabase: string): Promise<void> {
  assertLocalDatabase(url, { action: "connect", expectedDatabase });
  const client = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => undefined });
  try {
    await client`SELECT 1`;
  } catch {
    throw new Error(
      `PostgreSQL is running but not accepting connections for ${expectedDatabase}.`
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

export async function startLocalDb(target: LocalDbKind | "all" = "all"): Promise<void> {
  await ensureDocker();
  const kinds = kindsFrom(target);
  const services = kinds.map((kind) => LOCAL_DB_TARGETS[kind].service);
  const code = await runCommand("docker", [
    ...composeArgs(["up", "-d", "--wait", "--wait-timeout", "120", ...services]),
  ]);
  if (code !== 0) {
    for (const kind of kinds) {
      await waitForHealthy(kind);
    }
    return;
  }
  for (const kind of kinds) {
    await waitForHealthy(kind);
  }
}

export async function stopLocalDb(target: LocalDbKind | "all" = "all"): Promise<void> {
  await ensureDocker();
  const kinds = kindsFrom(target);
  const services = kinds.map((kind) => LOCAL_DB_TARGETS[kind].service);
  const code = await runCommand("docker", [...composeArgs(["stop", ...services])]);
  if (code !== 0) {
    throw new Error(`Failed to stop ${services.join(", ")}. Volumes were not deleted.`);
  }
}

export async function statusLocalDb(): Promise<void> {
  await ensureDocker();
  const code = await runCommand("docker", [...composeArgs(["ps"])]);
  if (code !== 0) {
    throw new Error(`Failed to read Compose status. ${DOCKER_STOPPED_MESSAGE}`);
  }
}

export async function logsLocalDb(kind: LocalDbKind, follow = false): Promise<void> {
  await ensureDocker();
  const args = follow
    ? composeArgs(["logs", "--tail", "100", "-f", LOCAL_DB_TARGETS[kind].service])
    : composeArgs(["logs", "--tail", "100", LOCAL_DB_TARGETS[kind].service]);
  const code = await runCommand("docker", args);
  if (code !== 0) {
    throw new Error(`Failed to read logs for ${LOCAL_DB_TARGETS[kind].container}.`);
  }
}

async function runTsxScript(
  scriptRelative: string,
  extraEnv: NodeJS.ProcessEnv
): Promise<void> {
  const code = await runCommand(process.execPath, [tsxCli, scriptRelative], {
    env: { ...process.env, ...extraEnv },
  });
  if (code !== 0) {
    throw new Error(`${scriptRelative} failed with exit code ${code}.`);
  }
}

function localDbEnv(kind: LocalDbKind): NodeJS.ProcessEnv {
  const url = localDatabaseUrl(kind);
  assertLocalDatabase(url, {
    action: `${kind} database command`,
    expectedDatabase: LOCAL_DB_TARGETS[kind].database,
  });
  return {
    DATABASE_URL: url,
    NODE_ENV:
      process.env.NODE_ENV && process.env.NODE_ENV !== "production"
        ? process.env.NODE_ENV
        : "development",
  };
}

export async function migrateLocalDb(kind: LocalDbKind): Promise<void> {
  await ensureDocker();
  await waitForHealthy(kind);
  const env = localDbEnv(kind);
  console.log(`Migrating ${describeDatabaseTarget(env.DATABASE_URL)}`);
  await runTsxScript("src/lib/db/migrate.ts", env);
}

export async function seedLocalDb(kind: LocalDbKind): Promise<void> {
  await ensureDocker();
  await waitForHealthy(kind);
  const env = localDbEnv(kind);
  console.log(`Seeding ${describeDatabaseTarget(env.DATABASE_URL)}`);
  await runTsxScript("src/lib/db/seed.ts", {
    ...env,
    NODE_ENV: "development",
  });
}

export async function resetLocalDb(kind: LocalDbKind): Promise<void> {
  await ensureDocker();
  await waitForHealthy(kind);
  const url = localDatabaseUrl(kind);
  const expectedDatabase = LOCAL_DB_TARGETS[kind].database;
  assertLocalDatabase(url, { action: "reset database", expectedDatabase });
  console.log(`Resetting ${describeDatabaseTarget(url)}`);
  await resetLocalPublicSchema(url, expectedDatabase);
  await migrateLocalDb(kind);
  await seedLocalDb(kind);
}

function parseFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function parsePrNumber(argv: string[]): number {
  const raw = parseFlag(argv, "--pr") ?? argv.find((value) => /^\d+$/.test(value));
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Provide a PR number with --pr <number>.");
  }
  return parsed;
}

function parseOptionalPort(argv: string[], fallback: number): number {
  const raw = parseFlag(argv, "--port");
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Port must be a positive integer.");
  }
  return parsed;
}

export async function startPrDb(prNumber: number, port = prDefaultPort(prNumber)): Promise<void> {
  await ensureDocker();
  const container = prContainerName(prNumber);
  const database = prDatabaseName(prNumber);
  const volume = prVolumeName(prNumber);
  const existing = await runCommandCapture("docker", [
    "ps",
    "-a",
    "--filter",
    `name=^${container}$`,
    "--format",
    "{{.Names}}",
  ]);
  if (existing.stdout.trim() === container) {
    const code = await runCommand("docker", ["start", container]);
    if (code !== 0) {
      throw new Error(`Failed to start existing container ${container}.`);
    }
  } else {
    const code = await runCommand("docker", [
      "run",
      "-d",
      "--name",
      container,
      "--restart",
      "unless-stopped",
      "-p",
      `127.0.0.1:${port}:5432`,
      "-e",
      `POSTGRES_USER=${LOCAL_DB_USER}`,
      "-e",
      `POSTGRES_PASSWORD=${LOCAL_DB_PASSWORD}`,
      "-e",
      `POSTGRES_DB=${database}`,
      "-v",
      `${volume}:/var/lib/postgresql/data`,
      "--health-cmd",
      `pg_isready -U ${LOCAL_DB_USER} -d ${database}`,
      "--health-interval",
      "2s",
      "--health-timeout",
      "5s",
      "--health-retries",
      "30",
      LOCAL_POSTGRES_IMAGE,
    ]);
    if (code !== 0) {
      throw new Error(`Failed to create ${container}.`);
    }
  }

  const started = Date.now();
  while (Date.now() - started < 60000) {
    const inspect = await runCommandCapture("docker", [
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      container,
    ]);
    if (inspect.code === 0 && inspect.stdout.trim() === "healthy") {
      const url = prDatabaseUrl(prNumber, port);
      await assertCanConnect(url, database);
      console.log(`PR database ready at ${describeDatabaseTarget(url)}`);
      console.log(`Container: ${container}`);
      console.log("This database is disposable and does not share dev/test volumes.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${container} to become healthy.`);
}

export async function stopPrDb(prNumber: number): Promise<void> {
  await ensureDocker();
  const container = prContainerName(prNumber);
  const code = await runCommand("docker", ["stop", container]);
  if (code !== 0) {
    throw new Error(`Failed to stop ${container}. Volume was not deleted.`);
  }
}

const E2E_STORAGE_ENV_NAMES = [
  "S3_REGION",
  "S3_ENDPOINT",
  "S3_FORCE_PATH_STYLE",
  "S3_BUCKET_NAME",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_CDN_URL",
  "S3_PRIVATE_BUCKET_NAME",
  "S3_PRIVATE_ACCESS_KEY_ID",
  "S3_PRIVATE_SECRET_ACCESS_KEY",
] as const;

function logWorktreeStorageEnvPresence(): void {
  const envLocalPath = path.join(repoRoot, ".env.local");
  const present = existsSync(envLocalPath);
  console.log(`E2E worktree .env.local exists=${present}`);
  if (!present) {
    console.warn(
      "E2E worktree is missing .env.local; Next may not have private storage credentials."
    );
    return;
  }

  const raw = readFileSync(envLocalPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (const name of E2E_STORAGE_ENV_NAMES) {
    const active = raw.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, "m"));
    const commented = new RegExp(`^\\s*#\\s*${name}\\s*=`, "m").test(raw);
    const value = active?.[1]?.trim().replace(/\r$/, "").replace(/^['"]|['"]$/g, "") ?? "";
    console.log(
      `E2E env ${name} present=${Boolean(active)} commented=${commented} empty=${Boolean(active) && value.length === 0}`
    );
  }
}

export async function runLocalE2E(playwrightArgs: string[] = []): Promise<void> {
  await startLocalDb("test");
  await resetLocalDb("test");
  const e2ePort = process.env.PAID_TALENT_E2E_PORT || "3000";
  if (e2ePort !== "3000") {
    console.warn(
      `PAID_TALENT_E2E_PORT=${e2ePort} is not 3000. Private R2 CORS allows http://localhost:3000 only, so browser profile-photo PUTs will fail.`
    );
  }
  logWorktreeStorageEnvPresence();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: localDatabaseUrl("test"),
    AUTH_DEV_BYPASS: "true",
    ADMIN_EMAILS: [process.env.ADMIN_EMAILS, "admin@example.com"]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(","),
    NODE_ENV: "development",
    PLAYWRIGHT_REUSE_SERVER: "false",
    PORT: e2ePort,
    BASE_URL: `http://localhost:${e2ePort}`,
    PLAYWRIGHT_WEB_SERVER_COMMAND: `npx next dev --hostname 0.0.0.0 --port ${e2ePort}`,
  };
  assertLocalDatabase(env.DATABASE_URL, {
    action: "authenticated e2e",
    expectedDatabase: LOCAL_DB_TARGETS.test.database,
  });
  console.log(
    `Running Playwright against ${describeDatabaseTarget(env.DATABASE_URL)} at ${env.BASE_URL}`
  );
  const code = await runCommand("npx", ["playwright", "test", ...playwrightArgs], {
    env,
    shell: true,
  });
  if (code !== 0) {
    throw new Error(`Playwright exited with code ${code}.`);
  }
}

function printUsage(): void {
  console.log(`Paid Talent local PostgreSQL helper

Usage:
  tsx scripts/local-db.ts <command> [dev|test|all] [options]

Commands:
  start [dev|test|all]     Start Compose Postgres and wait until healthy
  stop [dev|test|all]      Stop containers without deleting volumes
  status                   Show Compose service status
  logs [dev|test] [--follow]
  migrate [dev|test]       Migrate the selected local database
  seed [dev|test]          Seed the selected local database
  reset-data [dev|test]    Destructive reset of that local database only
  pr-start --pr <n> [--port <port>]
  pr-stop --pr <n>
  e2e                      Reset the test DB and run Playwright locally

Ordinary stop is not destructive. reset-data is explicit and local-only.
`);
}

async function main(argv: string[]): Promise<void> {
  const command = argv[0];
  if (!command || command === "help" || command === "--help") {
    printUsage();
    return;
  }

  switch (command) {
    case "start":
      await startLocalDb(parseKind(argv[1], "all"));
      return;
    case "stop":
      await stopLocalDb(parseKind(argv[1], "all"));
      return;
    case "status":
      await statusLocalDb();
      return;
    case "logs": {
      const kind = parseKind(argv[1], "dev");
      if (kind === "all") {
        throw new Error("logs requires dev or test.");
      }
      await logsLocalDb(kind, argv.includes("--follow"));
      return;
    }
    case "migrate": {
      const kind = parseKind(argv[1], "dev");
      if (kind === "all") {
        throw new Error("migrate requires dev or test.");
      }
      await migrateLocalDb(kind);
      return;
    }
    case "seed": {
      const kind = parseKind(argv[1], "dev");
      if (kind === "all") {
        throw new Error("seed requires dev or test.");
      }
      await seedLocalDb(kind);
      return;
    }
    case "reset-data": {
      const kind = parseKind(argv[1], "test");
      if (kind === "all") {
        throw new Error("reset-data requires dev or test. It never targets both.");
      }
      await resetLocalDb(kind);
      return;
    }
    case "pr-start": {
      const rest = argv.slice(1);
      const prNumber = parsePrNumber(rest);
      await startPrDb(prNumber, parseOptionalPort(rest, prDefaultPort(prNumber)));
      return;
    }
    case "pr-stop":
      await stopPrDb(parsePrNumber(argv.slice(1)));
      return;
    case "e2e":
      await runLocalE2E(argv.slice(1));
      return;
    default:
      printUsage();
      throw new Error(`Unknown command "${command}".`);
  }
}

function isDirectCli(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.normalize(entry).includes(`${path.sep}scripts${path.sep}local-db`);
}

if (isDirectCli()) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    printSafeError(error);
    process.exit(1);
  });
}
