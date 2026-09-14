import { test, expect } from "@playwright/test";
import { hasLocalAuthEnv, LOCAL_AUTH_SKIP_REASON } from "./helpers/local-auth";
import type { Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@example.com";
const WORKER_EMAIL = "worker1@example.com";

async function signInAs(page: Page, email: string, dest: string): Promise<void> {
  const request = page.context().request;
  const origin = process.env.BASE_URL || "http://localhost:3000";
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
}

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

  test("unauthenticated /admin/users preserves exact callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/auth\/signin/);
    const url = new URL(page.url());
    expect(url.searchParams.get("callbackUrl")).toBe("/admin/users");
  });

  test("unauthenticated /admin/settings preserves exact callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/auth\/signin/);
    const url = new URL(page.url());
    expect(url.searchParams.get("callbackUrl")).toBe("/admin/settings");
  });

  test("unauthenticated /admin/activity preserves exact callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin/activity");
    await expect(page).toHaveURL(/auth\/signin/);
    const url = new URL(page.url());
    expect(url.searchParams.get("callbackUrl")).toBe("/admin/activity");
  });
});

test.describe("Admin dashboard authenticated access", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!hasLocalAuthEnv(), LOCAL_AUTH_SKIP_REASON);
    test.skip(
      testInfo.project.name !== "chromium",
      "Authenticated admin checks run once on chromium"
    );
  });

  test("allowlisted admin can open the dashboard and sees Admin navigation", async ({
    page,
  }) => {
    await signInAs(page, ADMIN_EMAIL, "/recruiter/dashboard");
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible();
    await expect(page.getByText("Total users")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" })).toContainText("Users");
    await expect(page.getByRole("navigation", { name: "Admin" })).toContainText("Settings");
  });

  test("iPhone-width recruiter-admin header does not overflow or wrap Admin Dashboard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, ADMIN_EMAIL, "/recruiter/dashboard");
    await expect(page.getByText("Admin Dashboard")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible();
    const adminOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(adminOverflow).toBeLessThanOrEqual(1);
  });

  test("admin can search users and open billing settings", async ({ page }) => {
    await signInAs(page, ADMIN_EMAIL, "/admin");
    await page.goto("/admin/users?q=worker1%40example.com");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("link", { name: WORKER_EMAIL })).toBeVisible();
    await page.getByRole("link", { name: WORKER_EMAIL }).click();
    await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}/, {
      timeout: 20_000,
    });
    await expect(page.getByText("Account moderation")).toBeVisible();
    await expect(page.getByText("Subscription / Premium access")).toBeVisible();

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Subscription paywall")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Open Access" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enabled" })).toBeVisible();
  });

  test("normal worker cannot access admin pages or APIs", async ({ page, request }) => {
    await signInAs(page, WORKER_EMAIL, "/worker/dashboard");
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);

    const adminPage = await page.goto("/admin");
    expect(adminPage?.status()).toBe(404);

    const csrf = await (await request.get("/api/auth/csrf")).json();
    await request.post("/api/auth/callback/credentials", {
      form: {
        csrfToken: csrf.csrfToken,
        email: WORKER_EMAIL,
        callbackUrl: "http://localhost:3000/worker/dashboard",
        json: "true",
      },
      maxRedirects: 0,
    });
    const api = await request.post(
      "/api/admin/settings/billing",
      {
        data: {
          mode: "open_access",
          previousMode: "enforced",
          reason: "should fail",
        },
      }
    );
    expect(api.status()).toBeGreaterThanOrEqual(401);
  });
});
