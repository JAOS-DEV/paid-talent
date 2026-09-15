import type { FullConfig } from "@playwright/test";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = (
    config.projects[0]?.use?.baseURL || "http://localhost:3000"
  ).replace(/\/$/, "");
  const url = `${baseURL}/auth/signin`;
  const deadline = Date.now() + 120_000;
  let consecutiveOk = 0;
  let lastError = "not started";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0 && response.status < 500) {
        consecutiveOk += 1;
        if (consecutiveOk >= 3) {
          return;
        }
      } else {
        consecutiveOk = 0;
        lastError = `HTTP ${response.status}`;
      }
    } catch (error) {
      consecutiveOk = 0;
      lastError = error instanceof Error ? error.message : "connection failed";
    }
    await sleep(300);
  }

  throw new Error(
    `Local app was not ready at ${url} before Playwright tests started (${lastError}).`
  );
}
