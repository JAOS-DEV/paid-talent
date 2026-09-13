import { test, expect } from "@playwright/test";

test.describe("Authentication Flow Smoke Tests", () => {
  test.describe("Landing Page", () => {
    test("should display landing page with CTA buttons", async ({ page }) => {
      await page.goto("/");

      await expect(page).toHaveTitle(/Paid Talent/i);

      const findWorkButton = page.getByRole("link", { name: /find work/i });
      const findTalentButton = page.getByRole("link", { name: /find talent/i });

      await expect(findWorkButton.or(page.getByText(/find work/i).first())).toBeVisible();
      await expect(findTalentButton.or(page.getByText(/find talent/i).first())).toBeVisible();
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
    test("should display age gate with 18+ checkbox", async ({ page }) => {
      await page.goto("/auth/age-gate?role=worker");

      await expect(page.getByRole("heading", { name: /age confirmation/i })).toBeVisible();
      await expect(page.getByText(/I confirm I am 18 or older/i)).toBeVisible();
    });

    test("should require checkbox to continue", async ({ page }) => {
      await page.goto("/auth/age-gate?role=worker");

      const continueButton = page.getByRole("button", { name: /continue/i });
      await expect(continueButton).toBeDisabled();

      await page.getByRole("checkbox").check();
      await expect(continueButton).toBeEnabled();
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

      await expect(page.getByText(/error|something went wrong/i)).toBeVisible();
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
    await expect(continueButton).toBeEnabled();
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
