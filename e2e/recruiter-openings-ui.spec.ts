import { test, expect } from "@playwright/test";

/**
 * Unauthenticated access checks for recruiter profile/openings UI.
 * Full authenticated create/publish flow requires a seeded recruiter session
 * and DATABASE_URL — skipped when not available.
 */
test.describe("recruiter profile & openings routes", () => {
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

test.describe("recruiter openings authenticated smoke", () => {
  test.skip(
    !process.env.E2E_RECRUITER_EMAIL || !process.env.DATABASE_URL,
    "Requires E2E_RECRUITER_EMAIL and DATABASE_URL for authenticated flow"
  );

  test("placeholder — wire when recruiter e2e credentials exist", async () => {
    expect(true).toBe(true);
  });
});
