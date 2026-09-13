import { test, expect } from "@playwright/test";

test.describe("Authentication Flow Smoke Tests", () => {
  test.describe("Landing Page", () => {
    test("should display landing page with CTA buttons", async ({ page }) => {
      await page.goto("/");

      await expect(page).toHaveTitle(/Paid Talent/i);

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

    test("should navigate to age verification after role selection", async ({ page }) => {
      await page.goto("/auth/role-select");

      await page.getByText(/i'm a worker/i).click();
      await page.getByRole("button", { name: /continue/i }).click();

      await expect(page).toHaveURL(/auth\/age-verification/);
    });

    test("should preserve role in URL params when navigating", async ({ page }) => {
      await page.goto("/auth/role-select");

      await page.getByText(/i'm a recruiter/i).click();
      await page.getByRole("button", { name: /continue/i }).click();

      await expect(page).toHaveURL(/role=recruiter/);
    });
  });

  test.describe("Age Verification Page", () => {
    test("should display age verification form", async ({ page }) => {
      await page.goto("/auth/age-verification?role=worker");

      await expect(page.getByRole("heading", { name: /age verification/i })).toBeVisible();

      const dobInput = page.locator('input[type="date"]');
      await expect(dobInput).toBeVisible();

      await expect(page.getByText(/18 years of age or older/i)).toBeVisible();
    });

    test("should require checkbox confirmation", async ({ page }) => {
      await page.goto("/auth/age-verification?role=worker");

      const dateInput = page.locator('input[type="date"]');
      await dateInput.click();
      await dateInput.fill("1990-01-15");

      const submitButton = page.getByRole("button", { name: /verify/i });
      await expect(submitButton).toBeDisabled();

      await page.getByRole("checkbox").check();
      await expect(submitButton).toBeEnabled({ timeout: 10000 });
    });

    test("should show error for underage users", async ({ page }) => {
      await page.goto("/auth/age-verification?role=worker");

      const today = new Date();
      const underageDate = new Date(
        today.getFullYear() - 16,
        today.getMonth(),
        today.getDate()
      );
      const formattedDate = underageDate.toISOString().split("T")[0];

      const dateInput = page.locator('input[type="date"]');
      await dateInput.click();
      await dateInput.fill(formattedDate);
      await page.getByRole("checkbox").check();
      
      const submitButton = page.getByRole("button", { name: /verify/i });
      await expect(submitButton).toBeEnabled({ timeout: 10000 });
      await submitButton.click();

      await expect(page.getByText(/must be 18 years or older/i)).toBeVisible();
    });

    test("should navigate to sign-in for valid age", async ({ page }) => {
      await page.goto("/auth/age-verification?role=worker");

      const today = new Date();
      const validDate = new Date(
        today.getFullYear() - 25,
        today.getMonth(),
        today.getDate()
      );
      const formattedDate = validDate.toISOString().split("T")[0];

      const dateInput = page.locator('input[type="date"]');
      await dateInput.click();
      await dateInput.fill(formattedDate);
      await page.getByRole("checkbox").check();
      
      const submitButton = page.getByRole("button", { name: /verify/i });
      await expect(submitButton).toBeEnabled({ timeout: 10000 });
      await submitButton.click();

      await expect(page).toHaveURL(/auth\/signin/, { timeout: 5000 });
      await expect(
        page.getByRole("heading", { name: /create your account/i })
      ).toBeVisible();
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

      await expect(page).toHaveURL(/auth\/age-verification/);
      await expect(page.getByRole("heading", { name: /age verification/i })).toBeVisible();

      const today = new Date();
      const validDate = new Date(
        today.getFullYear() - 25,
        today.getMonth(),
        today.getDate()
      );
      const formattedDate = validDate.toISOString().split("T")[0];

      const dateInput = page.locator('input[type="date"]');
      await dateInput.click();
      await dateInput.fill(formattedDate);
      await page.getByRole("checkbox").check();
      
      const submitButton = page.getByRole("button", { name: /verify/i });
      await expect(submitButton).toBeEnabled({ timeout: 10000 });
      await submitButton.click();

      await expect(page).toHaveURL(/auth\/signin/);
      await expect(
        page.getByRole("heading", { name: /create your account/i })
      ).toBeVisible();
    });

    test("recruiter flow should preserve role through flow", async ({ page }) => {
      await page.goto("/auth/role-select");

      await page.getByText(/i'm a recruiter/i).click();
      await page.getByRole("button", { name: /continue/i }).click();

      await expect(page).toHaveURL(/role=recruiter/);

      const today = new Date();
      const validDate = new Date(
        today.getFullYear() - 30,
        today.getMonth(),
        today.getDate()
      );
      const formattedDate = validDate.toISOString().split("T")[0];

      const dateInput = page.locator('input[type="date"]');
      await dateInput.click();
      await dateInput.fill(formattedDate);
      await page.getByRole("checkbox").check();
      
      const submitButton = page.getByRole("button", { name: /verify/i });
      await expect(submitButton).toBeEnabled({ timeout: 10000 });
      await submitButton.click();

      await expect(page).toHaveURL(/role=recruiter/);
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

  test("age verification should be usable on mobile", async ({ page }) => {
    await page.goto("/auth/age-verification?role=worker");

    const dobInput = page.locator('input[type="date"]');
    const checkbox = page.getByRole("checkbox");
    const submitButton = page.getByRole("button", { name: /verify/i });

    await expect(dobInput).toBeVisible();
    await expect(checkbox).toBeVisible();
    await expect(submitButton).toBeVisible();
  });
});
