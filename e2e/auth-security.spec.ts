import { test, expect } from "@playwright/test";

/**
 * Auth Security E2E Tests
 *
 * CRITICAL SECURITY INVARIANT:
 * Submitting an existing user's email must NOT directly create a session.
 * Session creation requires either:
 * 1. Clicking a magic link sent to the email (verifies email ownership)
 * 2. OAuth sign-in (verifies identity via provider)
 * 3. Dev bypass explicitly enabled (NODE_ENV=development + AUTH_DEV_BYPASS=true)
 *
 * These tests verify that the account hijack vulnerability is prevented:
 * An attacker cannot gain access to an account by simply knowing the email.
 */

const EXISTING_USER_EMAIL = "worker1@example.com";

test.describe("Auth Security - Session Creation Guard", () => {
  test.describe("Production Mode (Dev Bypass Disabled)", () => {
    test("auth config should report devBypassEnabled=false in non-dev environments", async ({
      request,
    }) => {
      const response = await request.get("/api/auth/config");
      expect(response.status()).toBe(200);

      const config = await response.json();
      
      // In CI/production, dev bypass should be disabled
      // If this fails, the security gate is misconfigured
      if (process.env.NODE_ENV !== "development" || !process.env.AUTH_DEV_BYPASS) {
        expect(config.devBypassEnabled).toBe(false);
      }
    });

    test("submitting existing email should NOT create session without magic link click", async ({
      page,
    }) => {
      // Skip if dev bypass is enabled (only test security in production-like mode)
      const configResponse = await page.request.get("/api/auth/config");
      const config = await configResponse.json();
      
      if (config.devBypassEnabled) {
        test.skip(true, "Dev bypass enabled - skipping production security test");
      }

      await page.goto("/auth/signin");
      await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

      // Fill in an existing user's email
      const emailInput = page.getByLabel(/email/i);
      await emailInput.fill(EXISTING_USER_EMAIL);

      // Get cookies before submission
      const cookiesBefore = await page.context().cookies();
      const sessionCookieBefore = cookiesBefore.find(
        (c) => c.name.includes("authjs") || c.name.includes("next-auth")
      );

      // Submit the form
      const submitButton = page.getByRole("button", { name: /continue with email|send.*link/i });
      
      // If button is disabled, email auth is not configured - that's also secure
      if (await submitButton.isDisabled()) {
        // Email sign-in not available = secure (can't submit email-only)
        const disabledMessage = page.getByText(/email sign-in is not configured|please use google/i);
        await expect(disabledMessage).toBeVisible();
        return;
      }

      await submitButton.click();

      // Wait for navigation or response
      await Promise.race([
        page.waitForURL(/auth\/verify-request/, { timeout: 10000 }),
        page.waitForURL(/auth\/signin.*error/, { timeout: 10000 }),
        page.waitForSelector(".bg-red-500\\/10", { timeout: 10000, state: "visible" }),
      ]).catch(() => {});

      // CRITICAL: Check that no session cookie was created
      const cookiesAfter = await page.context().cookies();
      const sessionCookieAfter = cookiesAfter.find(
        (c) => c.name.includes("authjs") || c.name.includes("next-auth")
      );

      // If there was no session before, there should be no session after
      // (Unless magic link was actually clicked, which it wasn't)
      if (!sessionCookieBefore?.value) {
        expect(sessionCookieAfter?.value || "").toBeFalsy();
      }

      // Verify we're on verify-request page (magic link sent) OR showing an error
      const currentUrl = page.url();
      const onVerifyRequest = currentUrl.includes("/auth/verify-request");
      const onSigninWithError = currentUrl.includes("/auth/signin");
      const hasErrorMessage = await page.locator(".bg-red-500\\/10").isVisible();

      // Either redirected to verify-request (secure) or showing error (also secure)
      expect(onVerifyRequest || (onSigninWithError && hasErrorMessage) || hasErrorMessage).toBe(true);

      // If on verify-request page, verify the messaging
      if (onVerifyRequest) {
        await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
        await expect(page.getByText(/sign-in link has been sent/i)).toBeVisible();
      }
    });

    test("verify-request page should NOT have an active session", async ({ page }) => {
      // The verify-request page should be shown when awaiting magic link
      // There should be no session at this point
      await page.goto("/auth/verify-request");

      await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();

      // Verify no session cookie exists
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(
        (c) => (c.name.includes("authjs") || c.name.includes("next-auth")) && c.value
      );

      // A user on verify-request should not have an established session
      // (They're waiting for the magic link)
      expect(sessionCookie?.value || "").toBeFalsy();
    });

    test("direct API call to credentials provider should fail without dev bypass", async ({
      request,
    }) => {
      // Skip if dev bypass is enabled
      const configResponse = await request.get("/api/auth/config");
      const config = await configResponse.json();

      if (config.devBypassEnabled) {
        test.skip(true, "Dev bypass enabled - skipping production security test");
      }

      // Attempt to directly authenticate via credentials (should fail)
      const csrfResponse = await request.get("/api/auth/csrf");
      const csrfData = await csrfResponse.json();

      const signInResponse = await request.post("/api/auth/callback/credentials", {
        form: {
          csrfToken: csrfData.csrfToken,
          email: EXISTING_USER_EMAIL,
        },
      });

      // Should either fail (4xx) or redirect without creating session
      // The credentials provider should not even be registered in production
      const responseText = await signInResponse.text();
      const hasSessionInResponse = responseText.includes('"user"') && responseText.includes('"email"');
      
      expect(hasSessionInResponse).toBe(false);
    });
  });

  test.describe("Email Provider Security", () => {
    test("email submission flow should redirect to verify-request when email provider configured", async ({
      page,
    }) => {
      const configResponse = await page.request.get("/api/auth/config");
      const config = await configResponse.json();

      // Skip if dev bypass enabled (tests production security)
      if (config.devBypassEnabled) {
        test.skip(true, "Dev bypass enabled");
      }

      // Skip if email not configured (different but also secure path)
      if (!config.emailEnabled) {
        test.skip(true, "Email provider not configured");
      }

      await page.goto("/auth/signin");
      await page.getByLabel(/email/i).fill(EXISTING_USER_EMAIL);
      
      const submitButton = page.getByRole("button", { name: /send.*link/i });
      await submitButton.click();

      // Should redirect to verify-request
      await expect(page).toHaveURL(/auth\/verify-request/, { timeout: 15000 });
      await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
    });

    test("unknown email should show appropriate error, not silent failure", async ({
      page,
    }) => {
      const configResponse = await page.request.get("/api/auth/config");
      const config = await configResponse.json();

      if (config.devBypassEnabled) {
        test.skip(true, "Dev bypass enabled");
      }

      await page.goto("/auth/signin");
      await page.getByLabel(/email/i).fill("nonexistent-user-xyz@example.com");

      const submitButton = page.getByRole("button", { name: /continue with email|send.*link/i });
      
      if (await submitButton.isDisabled()) {
        // Email not configured - acceptable secure state
        return;
      }

      await submitButton.click();
      await page.waitForTimeout(3000);

      // Should either show error or redirect to verify-request
      // (Some implementations send magic link to unknown emails too, which is fine)
      const currentUrl = page.url();
      const hasError = await page.locator(".bg-red-500\\/10").isVisible();
      const onVerifyRequest = currentUrl.includes("/auth/verify-request");

      expect(hasError || onVerifyRequest).toBe(true);
    });
  });

  test.describe("Dev Bypass Guard Function", () => {
    test("auth config endpoint should exist and return valid structure", async ({
      request,
    }) => {
      const response = await request.get("/api/auth/config");
      expect(response.status()).toBe(200);

      const config = await response.json();
      expect(config).toHaveProperty("emailEnabled");
      expect(config).toHaveProperty("devBypassEnabled");
      expect(typeof config.emailEnabled).toBe("boolean");
      expect(typeof config.devBypassEnabled).toBe("boolean");
    });

    test("sign-in page should indicate security mode correctly", async ({ page }) => {
      await page.goto("/auth/signin");

      const configResponse = await page.request.get("/api/auth/config");
      const config = await configResponse.json();

      // Check button text reflects the current mode
      if (config.devBypassEnabled) {
        // Dev mode: button shows dev indicator
        await expect(page.getByRole("button", { name: /dev|continue with email/i })).toBeVisible();
      } else if (config.emailEnabled) {
        // Production with email: button shows magic link text
        await expect(page.getByRole("button", { name: /send.*link/i })).toBeVisible();
      } else {
        // No email configured: email submission should be disabled or hidden
        const submitButton = page.getByRole("button", { name: /continue with email|send.*link/i });
        if (await submitButton.isVisible()) {
          await expect(submitButton).toBeDisabled();
        }
      }
    });
  });
});

test.describe("Auth Security - Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("security behavior should be consistent on mobile", async ({ page }) => {
    const configResponse = await page.request.get("/api/auth/config");
    const config = await configResponse.json();

    if (config.devBypassEnabled) {
      test.skip(true, "Dev bypass enabled");
    }

    await page.goto("/auth/signin");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    await page.getByLabel(/email/i).fill(EXISTING_USER_EMAIL);

    const submitButton = page.getByRole("button", { name: /continue with email|send.*link/i });
    
    if (await submitButton.isDisabled()) {
      // Secure: email auth not available
      return;
    }

    await submitButton.click();

    // Same security checks as desktop
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(
      (c) => c.name.includes("authjs") || c.name.includes("next-auth")
    );

    // No session should be created without magic link click
    expect(sessionCookie?.value || "").toBeFalsy();
  });
});
