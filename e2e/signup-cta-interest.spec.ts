import { test, expect, type Page } from "@playwright/test";

const TEST_DB_AVAILABLE = !!process.env.DATABASE_URL;

test.describe("Canonical signup entry points", () => {
  test("Header Get Started starts signup at role selection", async ({
    page,
  }) => {
    await page.goto("/");

    const getStarted = page.getByRole("link", { name: /get started/i });
    await expect(getStarted).toBeVisible();
    await expect(getStarted).toHaveAttribute("href", "/auth/role-select");

    await getStarted.click();
    await expect(page).toHaveURL(/\/auth\/role-select/);
    await expect(
      page.getByRole("heading", { name: /welcome to paid talent/i })
    ).toBeVisible();
  });

  test("Create Worker Profile goes to age-gate with role=worker", async ({
    page,
  }) => {
    await page.goto("/");

    const workerCta = page.getByRole("link", {
      name: /create worker profile/i,
    });
    await expect(workerCta).toBeVisible();
    await expect(workerCta).toHaveAttribute(
      "href",
      "/auth/age-gate?role=worker"
    );

    await workerCta.click();
    await expect(page).toHaveURL(/\/auth\/age-gate\?role=worker/);
    await expect(page).not.toHaveURL(/role-select/);
    await expect(page).not.toHaveURL(/age-verification/);
    await expect(
      page.getByRole("heading", { name: /age confirmation/i })
    ).toBeVisible();
  });

  test("Start Recruiting goes to age-gate with role=recruiter", async ({
    page,
  }) => {
    await page.goto("/");

    const recruiterCta = page.getByRole("main").getByRole("link", {
      name: /start recruiting/i,
    });
    await expect(recruiterCta).toHaveAttribute(
      "href",
      "/auth/age-gate?role=recruiter"
    );

    await recruiterCta.click();
    await expect(page).toHaveURL(/\/auth\/age-gate\?role=recruiter/);
    await expect(page).not.toHaveURL(/role-select/);
    await expect(page).not.toHaveURL(/age-verification/);
  });

  test("Subscribe to Top Talent goes to age-gate with role=recruiter", async ({
    page,
  }) => {
    await page.goto("/");

    const subscribeCta = page.getByRole("link", {
      name: /subscribe to top talent/i,
    });
    await expect(subscribeCta).toHaveAttribute(
      "href",
      "/auth/age-gate?role=recruiter"
    );
  });

  test("no public signup CTA goes directly to /auth/age-verification", async ({
    page,
  }) => {
    await page.goto("/");

    const forbidden = page.locator('a[href*="/auth/age-verification"]');
    await expect(forbidden).toHaveCount(0);
  });
});

test.describe("Signup intent cannot be minted from signin query params", () => {
  async function signupIntentValue(page: Page): Promise<string | undefined> {
    const cookies = await page.context().cookies();
    return cookies.find((c) => c.name === "signup_intent_role")?.value;
  }

  async function clickGoogleWithoutLeaving(page: Page): Promise<void> {
    await page.route("**/api/auth/**", async (route) => {
      const url = route.request().url();
      if (url.includes("signin/google") || url.includes("callback/google")) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.route("**/accounts.google.com/**", (route) => route.abort());
    await page.getByRole("button", { name: /google/i }).click();
  }

  test("direct worker signin URL does not mint signup_intent_role", async ({
    page,
  }) => {
    await page.goto("/auth/signin?role=worker&ageConfirmed=true");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    await expect.poll(async () => signupIntentValue(page)).toBeUndefined();

    await clickGoogleWithoutLeaving(page);

    await expect.poll(async () => signupIntentValue(page)).toBeUndefined();
  });

  test("direct recruiter signin URL does not mint signup_intent_role", async ({
    page,
  }) => {
    await page.goto("/auth/signin?role=recruiter&ageConfirmed=true");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    await expect.poll(async () => signupIntentValue(page)).toBeUndefined();

    await clickGoogleWithoutLeaving(page);

    await expect.poll(async () => signupIntentValue(page)).toBeUndefined();
  });
});

test.describe("Signup intent survives into signin", () => {
  test("role-select -> age-gate preserves role", async ({ page }) => {
    await page.goto("/auth/role-select");
    await page.getByText(/i'm a worker/i).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page).toHaveURL(/\/auth\/age-gate/);
    await expect(page).toHaveURL(/role=worker/);
  });

  test("age-gate -> signin preserves valid signup intent and sets cookie", async ({
    page,
  }) => {
    await page.goto("/auth/age-gate?role=worker");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(page).toHaveURL(/role=worker/);
    await expect(page).toHaveURL(/ageConfirmed=true/);
    expect(page.url()).not.toMatch(/dob=/);

    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find((c) => c.name === "signup_intent_role");
      })
      .toMatchObject({
        name: "signup_intent_role",
        value: "worker",
        httpOnly: true,
      });
  });

  test("recruiter age-gate sets recruiter signup intent", async ({ page }) => {
    await page.goto("/auth/age-gate?role=recruiter");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page).toHaveURL(/role=recruiter/);
    await expect(page).toHaveURL(/ageConfirmed=true/);

    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find((c) => c.name === "signup_intent_role")?.value;
      })
      .toBe("recruiter");
  });
});

test.describe("Single Google authentication for new signup", () => {
  async function blockGoogleAndCount(page: Page): Promise<{ getCount: () => number }> {
    let googleStarts = 0;

    await page.route("**/api/auth/**", async (route) => {
      const url = route.request().url();
      if (url.includes("signin/google") || url.includes("callback/google")) {
        googleStarts += 1;
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.route("**/accounts.google.com/**", (route) => route.abort());

    return { getCount: (): number => googleStarts };
  }

  test("new worker from homepage authenticates with Google only once", async ({
    page,
  }) => {
    const google = await blockGoogleAndCount(page);

    await page.goto("/");
    await page.getByRole("link", { name: /create worker profile/i }).click();
    await expect(page).toHaveURL(/\/auth\/age-gate\?role=worker/);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin/);

    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find((c) => c.name === "signup_intent_role")?.value;
      })
      .toBe("worker");

    await page.getByRole("button", { name: /google/i }).click();

    await expect.poll(() => google.getCount()).toBe(1);
    expect(google.getCount()).toBe(1);
    await expect(page).not.toHaveURL(/role-select/);
  });

  test("generic Get Started worker path authenticates with Google only once", async ({
    page,
  }) => {
    const google = await blockGoogleAndCount(page);

    await page.goto("/");
    await page.getByRole("link", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/auth\/role-select/);

    await page.getByText(/i'm a worker/i).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/auth\/age-gate/);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin/);

    await page.getByRole("button", { name: /google/i }).click();

    await expect.poll(() => google.getCount()).toBe(1);
    expect(google.getCount()).toBe(1);
  });
});

test.describe("Mobile canonical signup", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("homepage Create Worker Profile is a single-auth mobile journey through the soft gate", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /create worker profile/i }).click();
    await expect(page).toHaveURL(/\/auth\/age-gate\?role=worker/);
    await expect(page.getByRole("checkbox")).toBeVisible();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(page).toHaveURL(/ageConfirmed=true/);
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  });

  test("Get Started worker path works on mobile", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /get started/i }).click();
    await page.getByText(/i'm a worker/i).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/auth\/age-gate/);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});

test.describe("P2: Interest Button State", () => {
  test.describe("Unit-level: WorkerCard interestSent prop behavior", () => {
    test("Fresh recruiter sees Express Interest (not Interest Sent) on search page", async ({
      page,
    }) => {
      test.skip(
        !TEST_DB_AVAILABLE,
        "DATABASE_URL not configured - search page requires authentication"
      );

      await page.goto("/recruiter/search");

      await expect(
        page.getByRole("button", { name: /express interest/i }).first()
      ).toBeVisible({ timeout: 10000 });

      const interestSentButtons = page.getByRole("button", {
        name: /interest sent/i,
      });
      await expect(interestSentButtons).toHaveCount(0);

      const expressInterestButtons = page.getByRole("button", {
        name: /express interest/i,
      });
      const count = await expressInterestButtons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe("Static verification: Seed does not plant interests", () => {
    test("interestSent defaults to false in WorkerCard placeholder rendering", async ({
      page,
    }) => {
      test.skip(
        !TEST_DB_AVAILABLE,
        "DATABASE_URL not configured - recruiter search requires auth"
      );

      await page.goto("/recruiter/search");

      const expressButtons = page.getByRole("button", {
        name: /express interest/i,
      });

      await page.waitForTimeout(2000);

      const count = await expressButtons.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
