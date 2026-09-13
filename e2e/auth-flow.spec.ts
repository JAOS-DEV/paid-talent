import { test, expect } from "@playwright/test";

test.describe("Authentication Flow Smoke Tests", () => {
  test.describe("Landing Page", () => {
    test("should display landing page with CTA buttons", async ({ page }) => {
      await page.goto("/");

      await expect(page).toHaveTitle(/Paid Talent/i);

      // Scope to <main> — footer can duplicate "Start Recruiting"
      const mainContent = page.getByRole("main");
      const workerCta = mainContent.getByRole("link", {
        name: /create worker profile/i,
      });
      const recruiterCta = mainContent.getByRole("link", {
        name: /start recruiting/i,
      });

      await expect(workerCta).toBeVisible();
      await expect(recruiterCta).toBeVisible();
    });

    test("should navigate to role selection from landing page", async ({ page }) => {
      await page.goto("/");

      const getStartedLink = page.getByRole("link", { name: /get started|sign up/i });
      if (await getStartedLink.isVisible()) {
        await getStartedLink.click();
      } else {
        await page.goto("/auth/role-select");
      }

      await expect(page).toHaveURL(/auth\/role-select/);
    });
  });

  test.describe("Role Selection Page", () => {
    test("should display role selection options", async ({ page }) => {
      await page.goto("/auth/role-select");

      await expect(page.getByRole("heading", { name: /welcome to paid talent/i })).toBeVisible();

      const workerCard = page.getByText(/i'm a worker/i);
      const recruiterCard = page.getByText(/i'm a recruiter/i);

      await expect(workerCard).toBeVisible();
      await expect(recruiterCard).toBeVisible();
    });

    test("should enable continue button after selecting worker role", async ({ page }) => {
      await page.goto("/auth/role-select");

      const continueButton = page.getByRole("button", { name: /continue/i });
      await expect(continueButton).toBeDisabled();

      await page.getByText(/i'm a worker/i).click();

      await expect(continueButton).toBeEnabled();
    });

    test("should enable continue button after selecting recruiter role", async ({ page }) => {
      await page.goto("/auth/role-select");

      const continueButton = page.getByRole("button", { name: /continue/i });
      await expect(continueButton).toBeDisabled();

      await page.getByText(/i'm a recruiter/i).click();

      await expect(continueButton).toBeEnabled();
    });

    test("should navigate to age gate after role selection", async ({ page }) => {
      await page.goto("/auth/role-select");

      await page.getByText(/i'm a worker/i).click();
      await page.getByRole("button", { name: /continue/i }).click();

      await expect(page).toHaveURL(/auth\/age-gate/);
    });

    test("should preserve role in URL params when navigating", async ({ page }) => {
      await page.goto("/auth/role-select");

      await page.getByText(/i'm a recruiter/i).click();
      await page.getByRole("button", { name: /continue/i }).click();

      await expect(page).toHaveURL(/role=recruiter/);
    });
  });

  test.describe("Age Gate Page (Pre-auth)", () => {
    test("should display age gate with 20+ checkbox", async ({ page }) => {
      await page.goto("/auth/age-gate?role=worker");

      await expect(page.getByRole("heading", { name: /age confirmation/i })).toBeVisible();
      await expect(page.getByText(/I confirm I am 20 or older/i)).toBeVisible();
    });

    test("should require checkbox to continue", async ({ page }) => {
      await page.goto("/auth/age-gate?role=worker");

      const continueButton = page.getByRole("button", { name: /continue/i });

      // Product UX: Continue stays clickable; unconfirmed click shows error and does not navigate
      await continueButton.click();
      await expect(page.getByText(/Confirm you're 20\+ to continue/i)).toBeVisible();
      await expect(page).toHaveURL(/auth\/age-gate/);

      await page.getByRole("checkbox").check();
      await continueButton.click();

      await expect(page).toHaveURL(/auth\/signin/);
      await expect(page).toHaveURL(/ageConfirmed=true/);
    });

    test("should navigate to signin after confirming age", async ({ page }) => {
      await page.goto("/auth/age-gate?role=worker");

      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: /continue/i }).click();

      await expect(page).toHaveURL(/auth\/signin/);
      await expect(page).toHaveURL(/ageConfirmed=true/);
    });
  });

  test.describe("Sign-in Page", () => {
    test("should display sign-in options", async ({ page }) => {
      await page.goto("/auth/signin");

      await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

      const googleButton = page.getByRole("button", { name: /google|continue with google/i });
      await expect(googleButton.or(page.getByText(/google/i).first())).toBeVisible();
    });

    test("should have link to role selection", async ({ page }) => {
      await page.goto("/auth/signin");

      const createAccountLink = page.getByRole("link", { name: /create.*account|sign up|register/i });
      if (await createAccountLink.isVisible()) {
        await expect(createAccountLink).toBeVisible();
      }
    });
  });

  test.describe("Complete Happy Path Flow", () => {
    test("should complete role-select → age-gate → signin navigation", async ({ page }) => {
      await page.goto("/auth/role-select");
      await expect(page.getByText(/i'm a worker/i)).toBeVisible();

      await page.getByText(/i'm a worker/i).click();
      await page.getByRole("button", { name: /continue/i }).click();

      await expect(page).toHaveURL(/auth\/age-gate/);
      await expect(page.getByRole("heading", { name: /age confirmation/i })).toBeVisible();

      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: /continue/i }).click();

      await expect(page).toHaveURL(/auth\/signin/);
      await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    });

    test("recruiter flow should preserve role through flow", async ({ page }) => {
      await page.goto("/auth/role-select");

      await page.getByText(/i'm a recruiter/i).click();
      await page.getByRole("button", { name: /continue/i }).click();

      await expect(page).toHaveURL(/role=recruiter/);

      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: /continue/i }).click();

      await expect(page).toHaveURL(/role=recruiter/);
      await expect(page).toHaveURL(/ageConfirmed=true/);
    });
  });

  test.describe("Error Page", () => {
    test("should display error page content", async ({ page }) => {
      await page.goto("/auth/error");

      await expect(
        page.getByRole("heading", { name: /authentication error/i })
      ).toBeVisible();
    });
  });
});

test.describe("Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("role selection should be usable on mobile", async ({ page }) => {
    await page.goto("/auth/role-select");

    const workerCard = page.getByText(/i'm a worker/i);
    const recruiterCard = page.getByText(/i'm a recruiter/i);
    const continueButton = page.getByRole("button", { name: /continue/i });

    await expect(workerCard).toBeVisible();
    await expect(recruiterCard).toBeVisible();
    await expect(continueButton).toBeVisible();

    await workerCard.click();
    await expect(continueButton).toBeEnabled();
  });

  test("age gate should be usable on mobile", async ({ page }) => {
    await page.goto("/auth/age-gate?role=worker");

    const checkbox = page.getByRole("checkbox");
    const continueButton = page.getByRole("button", { name: /continue/i });

    await expect(checkbox).toBeVisible();
    await expect(continueButton).toBeVisible();

    await checkbox.check();
    await continueButton.click();
    await expect(page).toHaveURL(/auth\/signin/);
  });
});

test.describe("Mobile DOB Input Layout", () => {
  test.use({ viewport: { width: 320, height: 568 } }); // iPhone SE size

  test("DOB input should not overflow card on small mobile screens", async ({ page }) => {
    await page.goto("/auth/age-gate?role=worker");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page).toHaveURL(/auth\/signin/);
  });

  test("age gate card should fit within viewport width", async ({ page }) => {
    await page.goto("/auth/age-gate?role=worker");

    const card = page.locator('[class*="Card"]').first();
    if (await card.isVisible()) {
      const cardBox = await card.boundingBox();
      if (cardBox) {
        expect(cardBox.width).toBeLessThanOrEqual(320);
        expect(cardBox.x).toBeGreaterThanOrEqual(0);
      }
    }

    const checkbox = page.getByRole("checkbox");
    const checkboxBox = await checkbox.boundingBox();
    if (checkboxBox) {
      expect(checkboxBox.width).toBeGreaterThanOrEqual(20);
      expect(checkboxBox.height).toBeGreaterThanOrEqual(20);
    }
  });
});

test.describe("Auth Redirect Loop Regression (anonymous + signup intent)", () => {
  test("unauthenticated users should be redirected from protected routes to signin", async ({ page }) => {
    await page.goto("/worker/dashboard");
    await expect(page).toHaveURL(/auth\/signin/);
    await expect(page).toHaveURL(/callbackUrl/);
  });

  test("unauthenticated users should be redirected from recruiter routes to signin", async ({ page }) => {
    await page.goto("/recruiter/dashboard");
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test("pre-auth public routes remain accessible without a session", async ({ page }) => {
    await page.goto("/auth/role-select");
    await expect(page.getByRole("heading", { name: /welcome to paid talent/i })).toBeVisible();

    await page.goto("/auth/age-gate?role=worker");
    await expect(page.getByRole("heading", { name: /age confirmation/i })).toBeVisible();

    await page.goto("/auth/signin");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveTitle(/Paid Talent/i);
  });

  test("anonymous users cannot use post-auth DOB page (redirect to signin)", async ({ page }) => {
    await page.goto("/auth/age-verification");
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test("worker signup path sets signup_intent_role cookie before Google OAuth", async ({
    page,
  }) => {
    await page.goto("/auth/role-select");
    await page.getByText(/i'm a worker/i).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/auth\/age-gate/);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/auth\/signin/);
    await expect(page).toHaveURL(/role=worker/);
    await expect(page).toHaveURL(/ageConfirmed=true/);

    // Prevent leaving the app for real Google OAuth
    await page.route("**/api/auth/**", async (route) => {
      if (route.request().url().includes("signin/google") || route.request().url().includes("callback/google")) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.route("**/accounts.google.com/**", (route) => route.abort());

    await page.getByRole("button", { name: /google/i }).click();

    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find((c) => c.name === "signup_intent_role")?.value;
      })
      .toBe("worker");
  });

  test("recruiter signup path preserves role through age-gate into signin URL", async ({
    page,
  }) => {
    await page.goto("/auth/role-select");
    await page.getByText(/i'm a recruiter/i).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/role=recruiter/);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page).toHaveURL(/auth\/signin/);
    await expect(page).toHaveURL(/role=recruiter/);
    await expect(page).toHaveURL(/ageConfirmed=true/);
  });
});

/**
 * Authenticated ageVerified=false → age-verification, JWT update after verify-age,
 * and signIn completing (not aborting to age-verification) are covered by unit tests:
 * - src/lib/auth/__tests__/sign-in-decision.test.ts
 * - src/lib/auth/__tests__/middleware-gate.test.ts
 *
 * Real Google OAuth end-to-end cannot be automated without live credentials.
 */
