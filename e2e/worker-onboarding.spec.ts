import { config as loadEnv } from "dotenv";
import { test, expect, type Page } from "@playwright/test";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const SEEDED_RECRUITER_EMAIL = "recruiter-pro@example.com";

function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function hasLocalAuthEnv(): boolean {
  return (
    isLocalDatabaseUrl(process.env.DATABASE_URL) &&
    process.env.AUTH_DEV_BYPASS === "true"
  );
}

async function signInAsRecruiter(page: Page): Promise<void> {
  const request = page.context().request;
  const csrf = await (await request.get("/api/auth/csrf")).json();
  const callback = await request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken: csrf.csrfToken,
      email: SEEDED_RECRUITER_EMAIL,
      callbackUrl: "http://localhost:3000/recruiter/dashboard",
      json: "true",
    },
    maxRedirects: 0,
  });

  if (callback.status() >= 400) {
    throw new Error(
      `Credentials callback failed: status=${callback.status()} body=${await callback.text()}`
    );
  }

  await page.goto("/recruiter/dashboard");
  await page.waitForURL(/\/(recruiter|auth\/age)/, { timeout: 20000 });

  if (page.url().includes("/auth/age")) {
    test.skip(
      true,
      "Seeded recruiter hit age gate; re-seed local DB (npm run db:seed)"
    );
  }
}

test.describe("worker onboarding and dashboard access", () => {
  test("unauthenticated dashboard access stays protected", async ({ page }) => {
    await page.goto("/worker/dashboard");
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test("unauthenticated onboarding access stays protected", async ({ page }) => {
    await page.goto("/worker/onboarding");
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test("age gate behaviour is unchanged", async ({ page }) => {
    await page.goto("/auth/age-gate?role=worker");
    await expect(
      page.getByRole("heading", { name: /age confirmation/i })
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeVisible();
  });
});

test.describe("recruiter cannot use worker dashboard", () => {
  test("seeded recruiter is redirected away from worker dashboard", async ({
    page,
  }) => {
    test.skip(
      !hasLocalAuthEnv(),
      "Requires localhost DATABASE_URL + AUTH_DEV_BYPASS=true with seeded recruiters"
    );

    await signInAsRecruiter(page);
    await page.goto("/worker/dashboard");
    await expect(page).not.toHaveURL(/\/worker\/dashboard/);
    await expect(page).toHaveURL(/\/(recruiter|auth)/);
  });
});
