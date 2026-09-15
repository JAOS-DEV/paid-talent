import { test, expect, type Page } from "@playwright/test";
import { hasLocalAuthEnv, LOCAL_AUTH_SKIP_REASON } from "./helpers/local-auth";

const SEEDED_WORKER_EMAIL = "worker1@example.com";

async function signInAsWorker(page: Page): Promise<void> {
  const origin = process.env.BASE_URL || "http://localhost:3000";
  const request = page.context().request;
  const csrf = await (await request.get("/api/auth/csrf")).json();
  const callback = await request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken: csrf.csrfToken,
      email: SEEDED_WORKER_EMAIL,
      callbackUrl: `${origin}/worker/profile`,
      json: "true",
    },
    maxRedirects: 0,
  });

  if (callback.status() >= 400) {
    throw new Error(
      `Credentials callback failed: status=${callback.status()} body=${await callback.text()}`
    );
  }

  await page.goto("/worker/profile");
  await page.waitForURL(/\/(worker|auth\/age)/, { timeout: 20000 });

  if (page.url().includes("/auth/age")) {
    test.skip(true, "Seeded worker hit age gate; re-seed local DB");
  }
}

test.describe("worker profile moderation and multi-availability", () => {
  test("unauthenticated profile editing stays protected", async ({ page }) => {
    await page.goto("/worker/profile");
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test("edit profile blocks profanity, supports new roles, and keeps multi-availability", async ({
    page,
  }) => {
    test.skip(!hasLocalAuthEnv(), LOCAL_AUTH_SKIP_REASON);
    test.setTimeout(60_000);

    await signInAsWorker(page);
    await expect(
      page.getByRole("heading", { name: "Edit Profile" })
    ).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole("button", { name: "Dancer" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "PR / Promotions" })
    ).toBeVisible();

    const bio = page.getByPlaceholder("Tell recruiters about yourself...");
    await bio.scrollIntoViewIfNeeded();
    const originalBio = await bio.inputValue();
    await bio.fill("fuck off cunt");
    await page.getByRole("button", { name: "Save Work Details" }).click();
    await expect(
      page.getByText("This text contains language that isn't allowed on public profiles.")
    ).toBeVisible({ timeout: 10000 });
    await expect(bio).toHaveValue("fuck off cunt");

    await bio.fill(originalBio);
    await page.getByRole("button", { name: "Save Work Details" }).click();
    await expect(page.getByText("Work details saved")).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: "Other" }).first().click();
    await expect(page.getByLabel("Other role")).toBeVisible();
    await page.getByRole("button", { name: "Other" }).first().click();

    async function ensureAvailabilitySelected(name: string): Promise<void> {
      const button = page.getByRole("button", { name, exact: true });
      const className = await button.getAttribute("class");
      if (!className?.includes("bg-primary-600")) {
        await button.click();
      }
    }

    await ensureAvailabilitySelected("Full-time");
    await ensureAvailabilitySelected("Part-time");
    await ensureAvailabilitySelected("On-call");
    await page.getByRole("button", { name: "Save Basic Info" }).click();
    await expect(page.getByText("Basic info saved")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Edit Profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Full-time", exact: true })).toHaveClass(
      /bg-primary-600/
    );
    await expect(page.getByRole("button", { name: "Part-time", exact: true })).toHaveClass(
      /bg-primary-600/
    );
    await expect(page.getByRole("button", { name: "On-call", exact: true })).toHaveClass(
      /bg-primary-600/
    );
  });
});
