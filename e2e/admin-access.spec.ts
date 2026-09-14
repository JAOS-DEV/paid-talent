import { test, expect } from "@playwright/test";

/**
 * Admin access shell — no real admin credentials required.
 * Middleware should redirect anonymous visitors to sign-in with callbackUrl.
 */
test.describe("Admin access shell", () => {
  test("unauthenticated /admin redirects to sign-in with callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/auth\/signin/);
    await expect(page).toHaveURL(/callbackUrl/);
    const url = new URL(page.url());
    expect(decodeURIComponent(url.searchParams.get("callbackUrl") || "")).toMatch(
      /\/admin/
    );
  });

  test("unauthenticated /admin/verifications redirects to sign-in", async ({
    page,
  }) => {
    await page.goto("/admin/verifications");
    await expect(page).toHaveURL(/auth\/signin/);
    await expect(page).toHaveURL(/callbackUrl/);
  });

  test("unauthenticated /admin/photos redirects to sign-in", async ({
    page,
  }) => {
    await page.goto("/admin/photos");
    await expect(page).toHaveURL(/auth\/signin/);
    await expect(page).toHaveURL(/callbackUrl/);
  });
});
