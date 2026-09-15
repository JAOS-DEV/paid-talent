import { test, expect, type Page } from "@playwright/test";
import { hasLocalAuthEnv, LOCAL_AUTH_SKIP_REASON } from "./helpers/local-auth";

const WORKER_EMAIL = "worker1@example.com";
const RECRUITER_EMAIL = "recruiter-pro@example.com";
const ADMIN_EMAIL = "admin@example.com";

async function signInAs(page: Page, email: string, dest: string): Promise<void> {
  const origin = process.env.BASE_URL || "http://localhost:3000";
  const request = page.context().request;
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

test.describe("manual photo moderation APIs", () => {
  test("unauthenticated photo moderation APIs are denied", async ({ request }) => {
    const pending = await request.get("/api/admin/photos/pending");
    const approve = await request.post(
      "/api/admin/photos/00000000-0000-0000-0000-000000000000/approve"
    );
    const reject = await request.post(
      "/api/admin/photos/00000000-0000-0000-0000-000000000000/reject"
    );
    const ownerPhotos = await request.get("/api/worker/photos");
    const ownerPreview = await request.get(
      "/api/worker/photos/00000000-0000-0000-0000-000000000000/preview"
    );

    expect(pending.status()).toBeGreaterThanOrEqual(401);
    expect(approve.status()).toBeGreaterThanOrEqual(401);
    expect(reject.status()).toBeGreaterThanOrEqual(401);
    expect(ownerPhotos.status()).toBeGreaterThanOrEqual(401);
    expect(ownerPreview.status()).toBeGreaterThanOrEqual(401);
  });
});

test.describe("manual photo moderation (authenticated)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!hasLocalAuthEnv(), LOCAL_AUTH_SKIP_REASON);
    test.skip(
      testInfo.project.name !== "chromium",
      "Authenticated photo checks run once on chromium"
    );
  });

  test("recruiter cannot list worker photos, preview staging, or moderate", async ({
    page,
    request,
  }) => {
    await signInAs(page, RECRUITER_EMAIL, "/recruiter/dashboard");

    const photos = await request.get("/api/worker/photos");
    const preview = await request.get(
      "/api/worker/photos/00000000-0000-0000-0000-000000000000/preview"
    );
    const pending = await request.get("/api/admin/photos/pending");
    const approve = await request.post(
      "/api/admin/photos/00000000-0000-0000-0000-000000000000/approve"
    );

    expect(photos.status()).toBeGreaterThanOrEqual(401);
    expect(preview.status()).toBeGreaterThanOrEqual(401);
    expect(pending.status()).toBeGreaterThanOrEqual(401);
    expect(approve.status()).toBeGreaterThanOrEqual(401);
  });

  test("worker photo list never leaks stagingKey", async ({ page, request }) => {
    await signInAs(page, WORKER_EMAIL, "/worker/profile");
    const photos = await request.get("/api/worker/photos");
    expect(photos.ok()).toBeTruthy();
    const body = (await photos.json()) as {
      photos?: Array<Record<string, unknown>>;
    };
    for (const photo of body.photos ?? []) {
      expect(photo).not.toHaveProperty("stagingKey");
    }
  });

  test("admin photo queue is available and copy no longer advertises lingerie", async ({
    page,
  }) => {
    await signInAs(page, ADMIN_EMAIL, "/admin/photos");
    await expect(page).toHaveURL(/\/admin\/photos/);
    await expect(
      page.getByRole("heading", { name: "Photo moderation" })
    ).toBeVisible();
    await expect(page.getByText(/Lingerie OK/i)).toHaveCount(0);
    await expect(
      page.getByText("Photos stay private until you approve them.")
    ).toBeVisible();
  });
});
