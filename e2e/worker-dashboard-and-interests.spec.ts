import { test, expect, type Page } from "@playwright/test";
import { hasLocalAuthEnv, LOCAL_AUTH_SKIP_REASON } from "./helpers/local-auth";

const SEEDED_RECRUITER_EMAIL = "recruiter-free@example.com";
const SEEDED_WORKER_EMAIL = "worker1@example.com";

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
    test.skip(true, "Seeded user hit age gate; re-seed local DB (npm run db:seed)");
  }
}

test.describe("recruiter interest card mobile layout", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({}, testInfo) => {
    test.skip(!hasLocalAuthEnv(), LOCAL_AUTH_SKIP_REASON);
    test.skip(
      testInfo.project.name !== "Mobile Safari" &&
        testInfo.project.name !== "chromium",
      "Layout regression runs on chromium and iPhone project"
    );
  });

  test("Request hire confirmation does not overlap worker details at iPhone width", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    if (testInfo.project.name === "chromium") {
      await page.setViewportSize({ width: 390, height: 844 });
    }

    await signInAs(page, SEEDED_RECRUITER_EMAIL, "/recruiter/interests");
    await expect(page.getByRole("heading", { name: "Your Interests" })).toBeVisible({
      timeout: 15000,
    });

    const card = page.locator('[data-testid="interest-card"]').first();
    await expect(card).toBeVisible();

    const name = card.locator("a").filter({ hasText: /.+/ }).first();
    const action = card.getByRole("button").first();
    const viewProfile = card.getByRole("link", { name: "View Profile" });

    await expect(name).toBeVisible();
    await expect(viewProfile).toBeVisible();

    if (await action.count()) {
      const nameBox = await name.boundingBox();
      const actionBox = await action.boundingBox();
      expect(nameBox).toBeTruthy();
      expect(actionBox).toBeTruthy();
      if (nameBox && actionBox) {
        const overlap =
          nameBox.x < actionBox.x + actionBox.width &&
          nameBox.x + nameBox.width > actionBox.x &&
          nameBox.y < actionBox.y + actionBox.height &&
          nameBox.y + nameBox.height > actionBox.y;
        expect(overlap).toBe(false);
      }
    }

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});

test.describe("worker dashboard metrics and preview", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({}, testInfo) => {
    test.skip(!hasLocalAuthEnv(), LOCAL_AUTH_SKIP_REASON);
    test.skip(
      testInfo.project.name !== "chromium",
      "Authenticated dashboard checks run once on chromium"
    );
  });

  test("shows database-backed views/interests and a recruiter preview without hire actions", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await signInAs(page, SEEDED_WORKER_EMAIL, "/worker/dashboard");
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible({
      timeout: 15000,
    });

    await expect(page.getByText("Unique recruiters in the last 30 days")).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByTestId("profile-views-count")).not.toHaveText("0");
    await expect(page.getByTestId("interest-received-count")).not.toHaveText("0");

    await page.getByRole("link", { name: "View Profile" }).click();
    await expect(page).toHaveURL(/\/worker\/profile\/preview/);
    await expect(page.getByText(/recruiter preview/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /i'm interested/i })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /request hire confirmation/i })
    ).toHaveCount(0);
  });
});
