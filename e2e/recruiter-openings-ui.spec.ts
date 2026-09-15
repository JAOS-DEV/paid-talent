import { test, expect, type Page } from "@playwright/test";
import { hasLocalAuthEnv, LOCAL_AUTH_SKIP_REASON } from "./helpers/local-auth";

/**
 * Recruiter profile & openings E2E
 *
 * Unauthenticated: always runs.
 * Authenticated: runs only against local paid_talent_test with
 * AUTH_DEV_BYPASS=true (use npm run test:e2e:local). paid_talent_dev,
 * other localhost DBs, and remote hosts never enable this suite.
 *
 * Seeded recruiter used: recruiter-pro@example.com
 * Seed includes published Hostess/Bartender and draft Server openings.
 */

const SEEDED_RECRUITER_EMAIL = "recruiter-pro@example.com";
const UNIQUE = `E2E ${Date.now()}`;

async function fillOpeningField(
  page: Page,
  label: RegExp,
  value: string
): Promise<void> {
  const field = page.getByLabel(label);
  await field.click();
  await field.fill(value);
  await expect(field).toHaveValue(value);
}

async function signInAsRecruiter(page: Page): Promise<void> {
  // Prefer Auth.js form callback (same path as production cookie session) over
  // client signIn({ redirect: false }), which can surface generic errors locally.
  const request = page.context().request;
  const origin = (process.env.BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const csrf = await (await request.get("/api/auth/csrf")).json();
  const callback = await request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken: csrf.csrfToken,
      email: SEEDED_RECRUITER_EMAIL,
      callbackUrl: `${origin}/recruiter/dashboard`,
      json: "true",
    },
    maxRedirects: 0,
  });

  if (callback.status() >= 400) {
    throw new Error(
      `Credentials callback failed: status=${callback.status()} body=${await callback.text()}`
    );
  }

  try {
    await page.goto("/recruiter/dashboard", { waitUntil: "domcontentloaded" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/interrupted by another navigation/i.test(message)) {
      throw error;
    }
  }
  await page.waitForURL(/\/(recruiter|auth\/age)/, { timeout: 20000 });

  if (page.url().includes("/auth/age")) {
    test.skip(
      true,
      "Seeded recruiter hit age gate; re-seed local DB (npm run db:seed)"
    );
  }

  await expect(page).toHaveURL(/\/recruiter/);
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible({
    timeout: 20000,
  });
}

async function gotoRecruiterPath(page: Page, path: string): Promise<void> {
  const destination = new RegExp(
    `${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\?.*)?$`
  );
  try {
    await page.goto(path, { waitUntil: "domcontentloaded" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/interrupted by another navigation/i.test(message)) {
      throw error;
    }
  }

  if (page.url().includes("/auth/signin")) {
    await signInAsRecruiter(page);
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
    } catch (retryError) {
      const retryMessage =
        retryError instanceof Error ? retryError.message : String(retryError);
      if (!/interrupted by another navigation/i.test(retryMessage)) {
        throw retryError;
      }
    }
  }

  await page.waitForURL(destination, { timeout: 20000 });
}

test.describe("recruiter profile & openings routes (unauthenticated)", () => {
  test("unauthenticated /recruiter/profile redirects to sign-in or age gate", async ({
    page,
  }) => {
    await page.goto("/recruiter/profile");
    await expect(page).toHaveURL(/\/auth\/(signin|age-gate|role-select)/);
  });

  test("unauthenticated /recruiter/openings redirects to auth", async ({
    page,
  }) => {
    await page.goto("/recruiter/openings");
    await expect(page).toHaveURL(/\/auth\/(signin|age-gate|role-select)/);
  });

  test("unauthenticated /recruiter/openings/new redirects to auth", async ({
    page,
  }) => {
    await page.goto("/recruiter/openings/new");
    await expect(page).toHaveURL(/\/auth\/(signin|age-gate|role-select)/);
  });
});

test.describe("recruiter profile & openings authenticated flow", () => {
  test.beforeEach(() => {
    test.skip(!hasLocalAuthEnv(), LOCAL_AUTH_SKIP_REASON);
  });

  test("profile save, draft→publish→edit, interest selector, delete", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signInAsRecruiter(page);

    const openingsApi = await page.request.get("/api/recruiter/openings");
    expect(
      openingsApi.ok(),
      `GET /api/recruiter/openings failed: ${openingsApi.status()} ${await openingsApi.text()}`
    ).toBe(true);
    const apiJson = await openingsApi.json();
    expect(
      (apiJson.openings as { isPublished: boolean }[]).some((o) => o.isPublished)
    ).toBe(true);

    // --- Profile ---
    await gotoRecruiterPath(page, "/recruiter/profile");
    await expect(
      page.getByRole("heading", { level: 1, name: "Venue Profile" })
    ).toBeVisible({ timeout: 15000 });

    await page.getByLabel(/venue \/ organisation name/i).fill(`Luxury Venues ${UNIQUE}`);
    await page.getByLabel(/^area \*/i).fill("Sukhumvit");
    await page
      .getByLabel(/about your venue/i)
      .fill(`E2E blurb for ${UNIQUE}. Great venue for nightlife staff.`);

    await page.getByRole("button", { name: /save profile/i }).click();
    await expect(
      page.getByText("Venue profile saved", { exact: true })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Venue profile complete", { exact: true }).first()
    ).toBeVisible();

    // --- Create draft opening ---
    await gotoRecruiterPath(page, "/recruiter/openings/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "New opening" })
    ).toBeVisible({ timeout: 15000 });
    const roleName = `E2E Role ${UNIQUE}`;
    await fillOpeningField(page, /^role \*/i, roleName);
    await fillOpeningField(page, /^area \*/i, "Central Pattaya");
    await fillOpeningField(page, /^pay$/i, "1200");
    await page.getByLabel(/^currency$/i).selectOption("USD");
    await page.getByLabel(/^pay period$/i).selectOption("week");
    await fillOpeningField(page, /^notes/i, "E2E draft notes");

    await page.getByRole("button", { name: /save as draft/i }).click();
    await page.waitForURL(/\/recruiter\/openings$/, { timeout: 15000 });

    await expect(page.getByRole("heading", { name: roleName })).toBeVisible();
    await expect(
      page.getByText("Draft", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.locator(".bg-charcoal-900").filter({ hasText: roleName })
    ).toContainText("1,200 USD / week");

    // --- Publish ---
    const card = page
      .locator(".bg-charcoal-900")
      .filter({ hasText: roleName })
      .first();
    await card.getByRole("button", { name: /^publish$/i }).click();
    await expect(card.getByText("Published", { exact: true })).toBeVisible({
      timeout: 10000,
    });

    // --- Edit ---
    await card.getByRole("link", { name: /^edit$/i }).click();
    await page.waitForURL(/\/recruiter\/openings\/.+\/edit/);
    const editedNotes = `E2E edited notes ${UNIQUE}`;
    await page.getByLabel(/^notes/i).fill(editedNotes);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("link", { name: /back to openings/i }).click();
    await page.waitForURL(/\/recruiter\/openings$/, { timeout: 20000 });
    await expect(
      page.locator(".bg-charcoal-900").filter({ hasText: roleName })
    ).toContainText(editedNotes);

    // --- Interest selector: published yes, draft Server no ---
    await gotoRecruiterPath(page, "/recruiter/openings");
    await expect(
      page.locator(".bg-charcoal-900").filter({ hasText: roleName })
    ).toContainText("Published");

    await gotoRecruiterPath(page, "/recruiter/search");
    await expect(page.getByLabel(/interested in hiring for/i)).toBeVisible({
      timeout: 15000,
    });

    const select = page.getByLabel(/interested in hiring for/i);

    // Server-action openings fetch can lag behind first paint; wait until
    // the empty-state helper disappears (published openings arrived).
    await expect(
      page.getByText("No published openings yet.")
    ).toBeHidden({ timeout: 20000 });

    const options = await select.locator("option").allTextContents();

    expect(options.some((o) => /general interest/i.test(o))).toBe(true);
    expect(
      options.some((o) => o.includes(roleName)),
      `Expected published opening "${roleName}" in options: ${JSON.stringify(options)}`
    ).toBe(true);
    expect(
      options.some((o) => /Server\s*[—-]/.test(o)),
      `Draft Server must not appear in options: ${JSON.stringify(options)}`
    ).toBe(false);

    // --- Delete the E2E opening cleanly ---
    await gotoRecruiterPath(page, "/recruiter/openings");
    const deleteCard = page
      .locator(".bg-charcoal-900")
      .filter({ hasText: roleName })
      .first();
    await deleteCard.getByRole("button", { name: /^delete$/i }).click();
    await expect(
      page.getByText(/delete this opening\?/i)
    ).toBeVisible();
    await deleteCard
      .getByRole("button", { name: /delete opening/i })
      .click();
    await expect(page.getByRole("heading", { name: roleName })).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test("venue profile and openings list link back to dashboard", async ({
    page,
  }) => {
    await signInAsRecruiter(page);

    await gotoRecruiterPath(page, "/recruiter/profile");
    const profileBack = page.getByRole("link", { name: /back to dashboard/i });
    await expect(profileBack).toBeVisible();
    await expect(profileBack).toHaveAttribute("href", "/recruiter/dashboard");

    await gotoRecruiterPath(page, "/recruiter/openings");
    const openingsBack = page.getByRole("link", { name: /back to dashboard/i });
    await expect(openingsBack).toBeVisible();
    await expect(openingsBack).toHaveAttribute("href", "/recruiter/dashboard");

    await gotoRecruiterPath(page, "/recruiter/openings/new");
    const openingsFormBack = page.getByRole("link", {
      name: /back to openings/i,
    });
    await expect(openingsFormBack).toBeVisible();
    await expect(openingsFormBack).toHaveAttribute("href", "/recruiter/openings");
  });

  test("new opening form uses single pay and does not overflow at 390px", async ({
    page,
  }) => {
    await signInAsRecruiter(page);
    await gotoRecruiterPath(page, "/recruiter/openings/new");
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByLabel(/^pay$/i)).toBeVisible();
    await expect(page.getByLabel(/^currency$/i)).toBeVisible();
    await expect(page.getByLabel(/^pay period$/i)).toBeVisible();
    await expect(page.getByLabel(/minimum pay/i)).toHaveCount(0);
    await expect(page.getByLabel(/maximum pay/i)).toHaveCount(0);

    await page.getByLabel(/^pay period$/i).selectOption("custom");
    await expect(page.getByLabel(/^duration$/i)).toBeVisible();
    await expect(page.getByLabel(/^unit$/i)).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasOverflow).toBe(false);
  });

  test("custom 15-day pay period displays after save", async ({ page }) => {
    test.setTimeout(90_000);
    await signInAsRecruiter(page);

    const roleName = `E2E Custom ${UNIQUE}`;
    await gotoRecruiterPath(page, "/recruiter/openings/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "New opening" })
    ).toBeVisible({ timeout: 15000 });
    await fillOpeningField(page, /^role \*/i, roleName);
    await fillOpeningField(page, /^area \*/i, "Sukhumvit");
    await fillOpeningField(page, /^pay$/i, "15000");
    await page.getByLabel(/^currency$/i).selectOption("THB");
    await page.getByLabel(/^pay period$/i).selectOption("custom");
    await fillOpeningField(page, /^duration$/i, "15");
    await page.getByLabel(/^unit$/i).selectOption("days");
    await page.getByRole("button", { name: /save as draft/i }).click();
    await page.waitForURL(/\/recruiter\/openings$/, { timeout: 15000 });

    const card = page.locator(".bg-charcoal-900").filter({ hasText: roleName });
    await expect(card).toContainText("15,000 THB / 15 days");

    await card.getByRole("button", { name: /^delete$/i }).click();
    await card.getByRole("button", { name: /delete opening/i }).click();
    await expect(page.getByRole("heading", { name: roleName })).toHaveCount(0, {
      timeout: 10000,
    });
  });
});
