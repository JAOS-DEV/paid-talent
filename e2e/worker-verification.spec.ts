import { test, expect, type Page } from "@playwright/test";
import { hasLocalAuthEnv, LOCAL_AUTH_SKIP_REASON } from "./helpers/local-auth";

const SEEDED_UNVERIFIED_WORKER = "worker6@example.com";
const SEEDED_RECRUITER = "recruiter-pro@example.com";

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

test.describe("worker verification (unauthenticated)", () => {
  test("unauthenticated page access is sent to sign-in", async ({ page }) => {
    await page.goto("/worker/verification");
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test("unauthenticated verification APIs are denied", async ({ request }) => {
    const status = await request.get("/api/worker/verification");
    const challenge = await request.post("/api/worker/verification/challenge", {
      data: { idDocumentKey: "verification-docs/user/id.jpg" },
    });
    const upload = await request.post("/api/worker/verification/upload", {
      data: { type: "id_document", contentType: "image/jpeg" },
    });

    expect(status.status()).toBeGreaterThanOrEqual(400);
    expect(challenge.status()).toBeGreaterThanOrEqual(400);
    expect(upload.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("worker verification (authenticated)", () => {
  test("unverified worker sees ID-first verification with no video picker", async ({
    page,
  }) => {
    test.skip(!hasLocalAuthEnv(), LOCAL_AUTH_SKIP_REASON);

    await signInAs(page, SEEDED_UNVERIFIED_WORKER, "/worker/verification");

    await expect(
      page.getByRole("heading", { name: /verify your identity/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Step 1 of 2")).toBeVisible();
    await expect(page.getByText("Upload your ID")).toBeVisible();
    await expect(page.getByText("Upload ID photo")).toBeVisible();
    await expect(page.getByText("Start video")).toHaveCount(0);
    await expect(page.getByText("Say this code")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /open camera/i })).toHaveCount(
      0
    );
    await expect(page.locator('input[type="file"][accept*="video"]')).toHaveCount(
      0
    );
    await expect(page.locator('input[type="file"][accept*="image"]')).toHaveCount(
      1
    );
  });

  test("recruiter cannot use worker verification APIs", async ({ page }) => {
    test.skip(!hasLocalAuthEnv(), LOCAL_AUTH_SKIP_REASON);

    await signInAs(page, SEEDED_RECRUITER, "/recruiter/dashboard");
    const response = await page.request.get("/api/worker/verification");
    expect(response.status()).toBe(403);
  });
});
