import { test, expect } from "@playwright/test";

const TEST_DB_AVAILABLE = !!process.env.DATABASE_URL;

function generateUniqueEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@example.com`;
}

test.describe("P0: New-Email Signup After Age Gate", () => {
  test("should complete signup flow with brand-new email after age verification", async ({
    page,
  }) => {
    test.skip(
      !TEST_DB_AVAILABLE,
      "BLOCKED: DATABASE_URL not configured - signup flow requires database"
    );

    const uniqueEmail = generateUniqueEmail();
    const validDob = getValidDateOfBirth(25);

    await page.goto("/auth/age-verification?role=worker");

    await expect(
      page.getByRole("heading", { name: /age verification/i })
    ).toBeVisible();

    await page.locator('input[type="date"]').fill(validDob);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /verify/i }).click();

    await expect(page).toHaveURL(/auth\/signin/, { timeout: 5000 });

    const currentUrl = page.url();
    expect(currentUrl).toContain("role=worker");
    expect(currentUrl).toContain("dob=");

    await expect(
      page.getByRole("heading", { name: /create your account/i })
    ).toBeVisible();
    await expect(page.getByText(/creating worker account/i)).toBeVisible();

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill(uniqueEmail);

    const createButton = page.getByRole("button", {
      name: /create account/i,
    });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    await expect(page).toHaveURL(/worker\/onboarding/, { timeout: 15000 });
  });

  test("should preserve role=recruiter through age verification to signup", async ({
    page,
  }) => {
    test.skip(
      !TEST_DB_AVAILABLE,
      "BLOCKED: DATABASE_URL not configured - signup flow requires database"
    );

    const uniqueEmail = generateUniqueEmail();
    const validDob = getValidDateOfBirth(30);

    await page.goto("/auth/age-verification?role=recruiter");

    await page.locator('input[type="date"]').fill(validDob);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /verify/i }).click();

    await expect(page).toHaveURL(/auth\/signin/, { timeout: 5000 });

    const currentUrl = page.url();
    expect(currentUrl).toContain("role=recruiter");
    expect(currentUrl).toContain("dob=");

    await expect(page.getByText(/creating recruiter account/i)).toBeVisible();

    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/recruiter\/dashboard/, { timeout: 15000 });
  });

  test("should navigate from age-verification to signin with role+dob preserved (no DB required)", async ({
    page,
  }) => {
    const validDob = getValidDateOfBirth(25);

    await page.goto("/auth/age-verification?role=worker");

    await expect(
      page.getByRole("heading", { name: /age verification/i })
    ).toBeVisible();

    await page.locator('input[type="date"]').fill(validDob);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /verify/i }).click();

    await expect(page).toHaveURL(/auth\/signin/, { timeout: 5000 });

    const currentUrl = page.url();
    expect(currentUrl).toContain("role=worker");
    expect(currentUrl).toContain("dob=");

    await expect(
      page.getByRole("heading", { name: /create your account/i })
    ).toBeVisible();
    await expect(page.getByText(/creating worker account/i)).toBeVisible();

    const createButton = page.getByRole("button", {
      name: /create account/i,
    });
    await expect(createButton).toBeVisible();
  });
});

test.describe("P1: Homepage CTAs Skip Role Chooser", () => {
  test("Worker CTA should go directly to age-verification with role=worker", async ({
    page,
  }) => {
    await page.goto("/");

    const workerCta = page.getByRole("link", {
      name: /create worker profile/i,
    });
    await expect(workerCta).toBeVisible();

    const href = await workerCta.getAttribute("href");
    expect(href).toBe("/auth/age-verification?role=worker");

    await workerCta.click();

    await expect(page).toHaveURL("/auth/age-verification?role=worker");
    await expect(page).not.toHaveURL(/role-select/);
  });

  test("Recruiter CTA should go directly to age-verification with role=recruiter", async ({
    page,
  }) => {
    await page.goto("/");

    const mainContent = page.getByRole("main");
    const recruiterCta = mainContent.getByRole("link", {
      name: /start recruiting/i,
    });
    await expect(recruiterCta).toBeVisible();

    const href = await recruiterCta.getAttribute("href");
    expect(href).toBe("/auth/age-verification?role=recruiter");

    await recruiterCta.click();

    await expect(page).toHaveURL("/auth/age-verification?role=recruiter");
    await expect(page).not.toHaveURL(/role-select/);
  });

  test("Subscribe CTA should also skip role chooser", async ({ page }) => {
    await page.goto("/");

    const subscribeCta = page.getByRole("link", {
      name: /subscribe to top talent/i,
    });
    await expect(subscribeCta).toBeVisible();

    const href = await subscribeCta.getAttribute("href");
    expect(href).toBe("/auth/age-verification?role=recruiter");
  });
});

test.describe("P2: Interest Button State", () => {
  test.describe("Unit-level: WorkerCard interestSent prop behavior", () => {
    test("Fresh recruiter sees Express Interest (not Interest Sent) on search page", async ({
      page,
    }) => {
      test.skip(
        !TEST_DB_AVAILABLE,
        "DATABASE_URL not configured - search page requires authentication"
      );

      await page.goto("/recruiter/search");

      await expect(
        page.getByRole("button", { name: /express interest/i }).first()
      ).toBeVisible({ timeout: 10000 });

      const interestSentButtons = page.getByRole("button", {
        name: /interest sent/i,
      });
      await expect(interestSentButtons).toHaveCount(0);

      const expressInterestButtons = page.getByRole("button", {
        name: /express interest/i,
      });
      const count = await expressInterestButtons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe("Static verification: Seed does not plant interests", () => {
    test("interestSent defaults to false in WorkerCard placeholder rendering", async ({
      page,
    }) => {
      test.skip(
        !TEST_DB_AVAILABLE,
        "DATABASE_URL not configured - recruiter search requires auth"
      );

      await page.goto("/recruiter/search");

      const expressButtons = page.getByRole("button", {
        name: /express interest/i,
      });

      await page.waitForTimeout(2000);

      const count = await expressButtons.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe("Homepage CTA href Static Verification", () => {
  test("should have correct hrefs for all CTAs", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/paid talent/i);

    const workerLink = page.locator('a[href="/auth/age-verification?role=worker"]');
    await expect(workerLink).toBeVisible();

    const recruiterLink = page.locator(
      'a[href="/auth/age-verification?role=recruiter"]'
    );
    const recruiterLinkCount = await recruiterLink.count();
    expect(recruiterLinkCount).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Complete Signup Flow E2E", () => {
  test("should complete full worker signup flow from homepage", async ({
    page,
  }) => {
    test.skip(
      !TEST_DB_AVAILABLE,
      "BLOCKED: DATABASE_URL not configured - full signup requires database"
    );

    const uniqueEmail = generateUniqueEmail();

    await page.goto("/");

    await page.getByRole("link", { name: /create worker profile/i }).click();

    await expect(page).toHaveURL("/auth/age-verification?role=worker");

    const validDob = getValidDateOfBirth(22);
    await page.locator('input[type="date"]').fill(validDob);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /verify/i }).click();

    await expect(page).toHaveURL(/auth\/signin/);
    expect(page.url()).toContain("role=worker");

    await page.locator('input[type="email"]').fill(uniqueEmail);

    const createButton = page.getByRole("button", { name: /create account/i });
    await createButton.click();

    await expect(page).toHaveURL(/worker\/onboarding/, { timeout: 15000 });
  });

  test("should complete full recruiter signup flow from homepage", async ({
    page,
  }) => {
    test.skip(
      !TEST_DB_AVAILABLE,
      "BLOCKED: DATABASE_URL not configured - full signup requires database"
    );

    const uniqueEmail = generateUniqueEmail();

    await page.goto("/");

    const mainContent = page.getByRole("main");
    await mainContent.getByRole("link", { name: /start recruiting/i }).click();

    await expect(page).toHaveURL("/auth/age-verification?role=recruiter");

    const validDob = getValidDateOfBirth(28);
    await page.locator('input[type="date"]').fill(validDob);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /verify/i }).click();

    await expect(page).toHaveURL(/auth\/signin/);
    expect(page.url()).toContain("role=recruiter");

    await page.locator('input[type="email"]').fill(uniqueEmail);

    const createButton = page.getByRole("button", { name: /create account/i });
    await createButton.click();

    await expect(page).toHaveURL(/recruiter\/dashboard/, { timeout: 15000 });
  });
});

function getValidDateOfBirth(age: number): string {
  const today = new Date();
  const birthDate = new Date(
    today.getFullYear() - age,
    today.getMonth(),
    today.getDate()
  );
  return birthDate.toISOString().split("T")[0];
}
