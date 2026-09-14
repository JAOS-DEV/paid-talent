import { test, expect } from "@playwright/test";
import {
  addPendingSignupCookie,
  countGoogleOAuthStarts,
  hasPendingSignupSecret,
  PENDING_SIGNUP_SKIP_REASON,
} from "./helpers/pending-signup";

const pendingEmail = `unknown-google-${Date.now()}@example.com`;

test.describe("Unknown Google account via Sign in (one OAuth)", () => {
  test.skip(!hasPendingSignupSecret(), PENDING_SIGNUP_SKIP_REASON);

  test("does not show Sign in again and never starts a second Google OAuth", async ({
    page,
    context,
    baseURL,
  }) => {
    const googleCount = await countGoogleOAuthStarts(page);
    await addPendingSignupCookie(context, {
      email: pendingEmail,
      baseURL: baseURL ?? "http://localhost:3000",
    });

    await page.goto("/auth/signin");
    await expect(page).toHaveURL(/\/auth\/role-select/);
    await expect(
      page.getByRole("heading", {
        name: /looks like you're new to paid talent/i,
      })
    ).toBeVisible();
    await expect(
      page.getByText(/let's finish creating your account/i)
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /sign in to your account/i })
    ).toHaveCount(0);

    await page.getByText(/i'm a worker/i).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/auth\/age-gate/);
    await expect(
      page.getByRole("heading", { name: /sign in to your account/i })
    ).toHaveCount(0);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/auth\/age-verification/);
    await expect(page).not.toHaveURL(/auth\/signin/);
    await expect(
      page.getByRole("heading", { name: /confirm your date of birth/i })
    ).toBeVisible();

    expect(googleCount()).toBe(0);
  });

  test("unknown identity cannot open Worker or Recruiter routes", async ({
    page,
    context,
    baseURL,
  }) => {
    await addPendingSignupCookie(context, {
      email: pendingEmail,
      baseURL: baseURL ?? "http://localhost:3000",
    });

    await page.goto("/worker/dashboard");
    await expect(page).toHaveURL(/\/auth\/role-select/);

    await page.goto("/recruiter/dashboard");
    await expect(page).toHaveURL(/\/auth\/role-select/);

    await page.goto("/search");
    await expect(page).toHaveURL(/\/auth\/role-select/);
  });

  test("role query params cannot skip the pending continuation", async ({
    page,
    context,
    baseURL,
  }) => {
    await addPendingSignupCookie(context, {
      email: pendingEmail,
      baseURL: baseURL ?? "http://localhost:3000",
    });

    await page.goto("/auth/age-verification?role=recruiter&email=attacker@example.com");
    await expect(page).toHaveURL(/\/auth\/role-select/);
    await expect(page).not.toHaveURL(/email=/);
  });
});

test.describe("Unknown Google account via Sign in — mobile", () => {
  test.skip(!hasPendingSignupSecret(), PENDING_SIGNUP_SKIP_REASON);
  test.use({ viewport: { width: 375, height: 667 } });

  test("mobile continuation never returns to Sign in", async ({
    page,
    context,
    baseURL,
  }) => {
    await addPendingSignupCookie(context, {
      email: `mobile-${pendingEmail}`,
      baseURL: baseURL ?? "http://localhost:3000",
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/role-select/);
    await expect(
      page.getByRole("heading", {
        name: /looks like you're new to paid talent/i,
      })
    ).toBeVisible();

    await page.getByText(/i'm a recruiter/i).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page).toHaveURL(/\/auth\/age-verification/);
    await expect(page.getByLabel(/date of birth/i)).toBeVisible();
    await expect(page).not.toHaveURL(/auth\/signin/);
  });
});
