import { test, expect } from "@playwright/test";

/**
 * Sign-In Form Submission E2E Tests
 *
 * These tests validate the actual form submission flow for email-based sign-in,
 * ensuring the app handles authentication correctly without crashing.
 *
 * REQUIREMENTS:
 * - DATABASE_URL environment variable must be set
 * - Database must be migrated: `npm run db:migrate`
 * - Database must be seeded: `npm run db:seed`
 *
 * The seed creates test users including:
 * - worker1@example.com (worker role, age verified)
 * - recruiter-pro@example.com (recruiter role, with subscription)
 *
 * Run with: npx playwright test signin-submit.spec.ts
 */

const SEEDED_WORKER_EMAIL = "worker1@example.com";
const UNKNOWN_EMAIL = "unknown-user-xyz@example.com";

test.describe("Sign-In Form Submission", () => {
  test.beforeEach(async ({ page }) => {
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    test.skip(
      !hasDatabaseUrl,
      "DATABASE_URL not set. Run `npm run db:migrate && npm run db:seed` with DATABASE_URL configured."
    );
  });

  test.describe("Valid Seed User Sign-In", () => {
    test("should successfully sign in with seed worker email and reach authenticated state", async ({
      page,
    }) => {
      await page.goto("/auth/signin");

      await expect(
        page.getByRole("heading", { name: /sign in/i })
      ).toBeVisible();
      await expect(page.locator("html")).toBeVisible();
      await expect(page.locator("body")).toBeVisible();

      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toBeVisible();
      await emailInput.fill(SEEDED_WORKER_EMAIL);

      const submitButton = page.getByRole("button", {
        name: /continue with email/i,
      });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      await Promise.race([
        page.waitForURL(/\/(worker|recruiter|onboarding)/, { timeout: 10000 }),
        page.waitForURL("/", { timeout: 10000 }),
        page.waitForSelector('[data-testid="error-message"]', {
          timeout: 10000,
          state: "attached",
        }),
      ]).catch(() => {});

      await expect(page.locator("html")).toBeVisible();
      await expect(page.locator("body")).toBeVisible();

      const currentUrl = page.url();
      const hasAuthError = await page.locator(".bg-red-500\\/10").isVisible();

      if (hasAuthError) {
        const errorText = await page.locator(".bg-red-500\\/10").textContent();
        expect.soft(errorText).not.toContain("error");
        test.fail(true, `Sign-in failed with error: ${errorText}`);
      }

      const isAuthenticated =
        currentUrl.includes("/worker") ||
        currentUrl.includes("/recruiter") ||
        currentUrl.includes("/onboarding") ||
        currentUrl === new URL("/", page.url()).toString();

      expect(isAuthenticated).toBe(true);
    });

    test("should not crash with missing html/body after form submission", async ({
      page,
    }) => {
      await page.goto("/auth/signin");

      await page.getByLabel(/email/i).fill(SEEDED_WORKER_EMAIL);
      await page.getByRole("button", { name: /continue with email/i }).click();

      await page.waitForTimeout(2000);

      const html = await page.locator("html").count();
      const body = await page.locator("body").count();

      expect(html).toBe(1);
      expect(body).toBe(1);

      const pageContent = await page.content();
      expect(pageContent).toMatch(/<html[\s\S]*>/);
      expect(pageContent).toMatch(/<body[\s\S]*>/);
    });
  });

  test.describe("Unknown Email Handling", () => {
    test("should show friendly error for unknown email without crashing", async ({
      page,
    }) => {
      await page.goto("/auth/signin");

      await expect(
        page.getByRole("heading", { name: /sign in/i })
      ).toBeVisible();

      const emailInput = page.getByLabel(/email/i);
      await emailInput.fill(UNKNOWN_EMAIL);

      const submitButton = page.getByRole("button", {
        name: /continue with email/i,
      });
      await submitButton.click();

      await page.waitForTimeout(2000);

      await expect(page.locator("html")).toBeVisible();
      await expect(page.locator("body")).toBeVisible();

      const errorMessage = page.locator(".bg-red-500\\/10");
      await expect(errorMessage).toBeVisible({ timeout: 5000 });

      const errorText = await errorMessage.textContent();
      expect(errorText?.toLowerCase()).toMatch(
        /no account|not found|doesn't exist|sign up/i
      );
    });

    test("should stay on signin page after unknown email submission", async ({
      page,
    }) => {
      await page.goto("/auth/signin");

      await page.getByLabel(/email/i).fill(UNKNOWN_EMAIL);
      await page.getByRole("button", { name: /continue with email/i }).click();

      await page.waitForTimeout(2000);

      expect(page.url()).toContain("/auth/signin");

      await expect(
        page.getByRole("heading", { name: /sign in/i })
      ).toBeVisible();
    });
  });

  test.describe("Form Validation", () => {
    test("submit button should be disabled when email is empty", async ({
      page,
    }) => {
      await page.goto("/auth/signin");

      const submitButton = page.getByRole("button", {
        name: /continue with email/i,
      });
      await expect(submitButton).toBeDisabled();
    });

    test("submit button should enable when email is entered", async ({
      page,
    }) => {
      await page.goto("/auth/signin");

      const submitButton = page.getByRole("button", {
        name: /continue with email/i,
      });
      await expect(submitButton).toBeDisabled();

      await page.getByLabel(/email/i).fill("test@example.com");
      await expect(submitButton).toBeEnabled();
    });
  });
});

test.describe("Sign-In Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    test.skip(
      !hasDatabaseUrl,
      "DATABASE_URL not set. Run `npm run db:migrate && npm run db:seed` with DATABASE_URL configured."
    );
  });

  test("should handle form submission on mobile viewport", async ({ page }) => {
    await page.goto("/auth/signin");

    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
    await emailInput.fill(SEEDED_WORKER_EMAIL);

    const submitButton = page.getByRole("button", {
      name: /continue with email/i,
    });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    await page.waitForTimeout(2000);

    await expect(page.locator("html")).toBeVisible();
    await expect(page.locator("body")).toBeVisible();
  });
});
