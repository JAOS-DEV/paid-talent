import { test, expect } from "@playwright/test";

/**
 * Admin access shell — no real admin credentials required.
 * Middleware + per-page requireAdminPage preserve the exact requested path.
 */
test.describe("Admin access shell", () => {
  test("unauthenticated /admin redirects with exact callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/auth\/signin/);
    const url = new URL(page.url());
    expect(url.searchParams.get("callbackUrl")).toBe("/admin");
  });

  test("unauthenticated /admin/verifications preserves exact callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin/verifications");
    await expect(page).toHaveURL(/auth\/signin/);
    const url = new URL(page.url());
    expect(url.searchParams.get("callbackUrl")).toBe("/admin/verifications");
  });

  test("unauthenticated /admin/photos preserves exact callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin/photos");
    await expect(page).toHaveURL(/auth\/signin/);
    const url = new URL(page.url());
    expect(url.searchParams.get("callbackUrl")).toBe("/admin/photos");
  });
});
