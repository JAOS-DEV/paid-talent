import { test, expect, type Page } from "@playwright/test";
import { hasLocalAuthEnv, LOCAL_AUTH_SKIP_REASON } from "./helpers/local-auth";

const SEEDED_UNVERIFIED_RECRUITER = "recruiter-free@example.com";

async function signInAs(page: Page, email: string, dest: string): Promise<void> {
  const origin = process.env.BASE_URL || "http://localhost:3000";
  const request = page.context().request;
  const csrf = await (await request.get("/api/auth/csrf")).json();
  const callback = await request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken: csrf.csrfToken,
      email,
      callbackUrl: `${origin}${dest}`,
      json: "true",
    },
    maxRedirects: 0,
  });

  if (callback.status() >= 400) {
    throw new Error(
      `Credentials callback failed: status=${callback.status()} body=${await callback.text()}`
    );
  }

  await page.goto(dest);
  await page.waitForURL(/\/(worker|recruiter|auth\/age)/, { timeout: 20000 });

  if (page.url().includes("/auth/age")) {
    test.skip(
      true,
      "Seeded user hit age gate; re-seed local DB (npm run db:seed)"
    );
  }

  if (!page.url().includes(dest)) {
    await page.goto(dest);
  }

  const destPattern = dest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page).toHaveURL(new RegExp(destPattern));
}

test.describe("recruiter verification", () => {
  test("unauthenticated page access is sent to sign-in", async ({ page }) => {
    await page.goto("/recruiter/verification");
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test("unverified recruiter sees verification page and dashboard banner", async ({
    page,
  }) => {
    test.skip(!hasLocalAuthEnv(), LOCAL_AUTH_SKIP_REASON);

    await signInAs(page, SEEDED_UNVERIFIED_RECRUITER, "/recruiter/verification");

    await expect(
      page.getByRole("heading", { name: /verify your identity/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Upload your ID")).toBeVisible();

    await page.goto("/recruiter/dashboard");
    await expect(page.getByTestId("recruiter-verification-banner")).toBeVisible({
      timeout: 15000,
    });
  });
});
