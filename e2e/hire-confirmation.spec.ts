import { test, expect, type Page } from "@playwright/test";
import { hasLocalAuthEnv, LOCAL_AUTH_SKIP_REASON } from "./helpers/local-auth";

/**
 * Two-sided hire confirmation E2E
 *
 * Unauthenticated: always runs.
 * Authenticated: runs only against local paid_talent_test with
 * AUTH_DEV_BYPASS=true (use npm run test:e2e:local). paid_talent_dev,
 * other localhost DBs, and remote hosts never enable this suite.
 *
 * Seeded pair: recruiter-free@example.com ↔ worker4@example.com (interested)
 */

const SEEDED_RECRUITER_EMAIL = "recruiter-free@example.com";
const SEEDED_WORKER_EMAIL = "worker4@example.com";
const SEEDED_WORKER_NAME = "Araya S.";

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
  await page.waitForURL(/\/(recruiter|worker|auth\/age)/, { timeout: 20000 });

  if (page.url().includes("/auth/age")) {
    test.skip(
      true,
      "Seeded user hit age gate; re-seed local DB (npm run db:seed)"
    );
  }

  const destPattern = dest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page).toHaveURL(new RegExp(destPattern));
}

test.describe("hire confirmation routes (unauthenticated)", () => {
  test("unauthenticated hire request is denied", async ({ request }) => {
    const response = await request.post("/api/recruiter/interests/request-hire", {
      data: { interestId: "11111111-1111-4111-8111-111111111111" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("unauthenticated worker confirmation is denied", async ({ request }) => {
    const response = await request.post(
      "/api/worker/hire-confirmations/11111111-1111-4111-8111-111111111111/confirm"
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("two-sided hire confirmation authenticated flow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({}, testInfo) => {
    test.skip(
      !hasLocalAuthEnv(),
      LOCAL_AUTH_SKIP_REASON
    );
    test.skip(
      testInfo.project.name !== "chromium",
      "DB-mutating authenticated flow runs once on chromium"
    );
  });

  test("recruiter request → worker confirm hire → request start → confirm started", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await signInAs(page, SEEDED_RECRUITER_EMAIL, "/recruiter/interests");
    await expect(page.getByRole("heading", { name: "Your Interests" })).toBeVisible({
      timeout: 15000,
    });

    const workerCard = page.locator(
      `[data-testid="interest-card"][data-worker-name="${SEEDED_WORKER_NAME}"]`
    );

    const requestHire = workerCard.getByRole("button", {
      name: "Request hire confirmation",
    });

    if ((await requestHire.count()) === 0) {
      test.skip(
        true,
        "Seeded interested pair is no longer interested; re-seed local DB to replay this flow"
      );
    }

    await requestHire.click();
    await expect(workerCard.getByText("Awaiting talent confirmation")).toBeVisible({
      timeout: 10000,
    });
    await expect(workerCard.getByText("Hired", { exact: true })).toHaveCount(0);

    await page.context().clearCookies();
    await signInAs(page, SEEDED_WORKER_EMAIL, "/worker/dashboard");
    await expect(page.getByText("Action required").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText(/says they have hired you/i).first()
    ).toBeVisible();

    await page.getByRole("button", { name: "Confirm hired" }).click();
    await expect(page.getByText("Action required")).toHaveCount(0, {
      timeout: 10000,
    });

    await page.context().clearCookies();
    await signInAs(page, SEEDED_RECRUITER_EMAIL, "/recruiter/interests");
    await expect(page.getByText("Hired").first()).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: "Request start confirmation" }).click();
    await expect(page.getByText("Awaiting start confirmation").first()).toBeVisible({
      timeout: 10000,
    });

    await page.context().clearCookies();
    await signInAs(page, SEEDED_WORKER_EMAIL, "/worker/dashboard");
    await expect(
      page.getByText(/says you have started working/i).first()
    ).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Confirm started" }).click();
    await expect(page.getByText("Action required")).toHaveCount(0, {
      timeout: 10000,
    });

    await page.context().clearCookies();
    await signInAs(page, SEEDED_RECRUITER_EMAIL, "/recruiter/interests");
    await expect(page.getByRole("heading", { name: "Your Interests" })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page
        .locator(
          `[data-testid="interest-card"][data-worker-name="${SEEDED_WORKER_NAME}"]`
        )
        .getByText("Started", { exact: true })
    ).toBeVisible({ timeout: 15000 });
  });

  test("worker can reject a hire request without becoming hired", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await signInAs(page, SEEDED_RECRUITER_EMAIL, "/recruiter/interests");
    await expect(page.getByRole("heading", { name: "Your Interests" })).toBeVisible({
      timeout: 15000,
    });
    const workerCard = page.locator(
      '[data-testid="interest-card"][data-worker-name="Tanawat W."]'
    );
    await expect(workerCard).toBeVisible({ timeout: 15000 });
    await expect(
      workerCard.getByRole("button", { name: "Request hire confirmation" })
    ).toBeVisible();

    await workerCard.getByRole("button", { name: "Request hire confirmation" }).click();
    await expect(workerCard.getByText("Awaiting talent confirmation")).toBeVisible({
      timeout: 10000,
    });

    await page.context().clearCookies();
    await signInAs(page, "worker5@example.com", "/worker/dashboard");
    await expect(page.getByText("Action required").first()).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: "This isn't correct" }).click();
    await expect(page.getByText("Action required")).toHaveCount(0, {
      timeout: 10000,
    });

    await page.context().clearCookies();
    await signInAs(page, SEEDED_RECRUITER_EMAIL, "/recruiter/interests");
    const afterReject = page.locator(
      '[data-testid="interest-card"][data-worker-name="Tanawat W."]'
    );
    await expect(afterReject.getByText("Talent did not confirm the hire")).toBeVisible({
      timeout: 15000,
    });
    await expect(afterReject.getByText("Hired", { exact: true })).toHaveCount(0);
  });
});
