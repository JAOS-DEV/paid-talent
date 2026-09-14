import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitestCli = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");

const child = spawn(
  process.execPath,
  [vitestCli, "run", "src/lib/db/__tests__/docker-postgres.integration.test.ts"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      RUN_DOCKER_DB_TESTS: "1",
    },
    windowsHide: true,
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : "Failed to start Docker DB integration tests.");
  process.exit(1);
});
