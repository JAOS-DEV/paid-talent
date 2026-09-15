import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { hasLocalAuthEnv, LOCAL_AUTH_SKIP_REASON } from "./helpers/local-auth";
import { attachUploadStageCapture } from "./helpers/upload-stage-capture";

const WORKER_EMAIL = "worker6@example.com";
const RECRUITER_EMAIL = "recruiter-pro@example.com";
const ADMIN_EMAIL = "admin@example.com";

const JPEG_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcD//Z",
  "base64"
);

const MP4_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x00, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
  0x00, 0x00, 0x00, 0x08, 0x6d, 0x64, 0x61, 0x74,
]);

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
  await page.waitForURL(/\/(worker|recruiter|admin|auth\/age)/, {
    timeout: 20000,
  });

  if (page.url().includes("/auth/age")) {
    test.skip(true, "Seeded user hit age gate; re-seed local DB (npm run db:seed)");
  }

  if (!page.url().includes(dest)) {
    await page.goto(dest);
  }
}

async function openRole(
  browser: Browser,
  email: string,
  dest: string
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, email, dest);
  return { context, page };
}

async function uploadJpeg(
  page: Page,
  buttonTestId: string,
  fileName: string
): Promise<void> {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByTestId(buttonTestId).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: fileName,
    mimeType: "image/jpeg",
    buffer: JPEG_BYTES,
  });
}

async function workerProfile(page: Page): Promise<{
  id: string;
  photoKey: string | null;
  photoUrl: string | null;
  verificationStatus: string;
}> {
  const response = await page.request.get("/api/worker/profile");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    profile: {
      id: string;
      photoKey: string | null;
      photoUrl: string | null;
      verificationStatus: string;
    };
  };
  return body.profile;
}

async function ownedPhotos(page: Page): Promise<{
  photos: Array<{
    id: string;
    photoUrl: string | null;
    previewUrl: string | null;
    moderationStatus: string;
    isCurrentApproved: boolean;
    stagingKey?: unknown;
  }>;
  canAddGalleryPhoto?: boolean;
  hasApprovedPrimaryPhoto?: boolean;
}> {
  const response = await page.request.get("/api/worker/photos");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Awaited<ReturnType<typeof ownedPhotos>>;
}

async function recruiterSearchHasWorker(
  page: Page,
  profileId: string
): Promise<boolean> {
  const response = await page.request.get(
    `/api/workers/search?query=${encodeURIComponent("Mayuree")}&limit=20`
  );
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    results?: Array<{ id: string; photoUrl: string | null }>;
    workers?: Array<{ id: string; photoUrl: string | null }>;
  };
  const results = body.results ?? body.workers ?? [];
  return results.some((worker) => worker.id === profileId);
}

async function recruiterWorkerDetail(
  page: Page,
  profileId: string
): Promise<{ status: number; profile?: { photoUrl: string | null; photos: Array<{ id: string; photoUrl: string; isCurrentApproved: boolean }> } }> {
  const response = await page.request.get(`/api/workers/${profileId}`);
  if (!response.ok()) {
    return { status: response.status() };
  }
  const body = (await response.json()) as {
    profile: {
      photoUrl: string | null;
      photos: Array<{
        id: string;
        photoUrl: string;
        isCurrentApproved: boolean;
      }>;
    };
  };
  return { status: response.status(), profile: body.profile };
}

async function submitIdentityForReview(page: Page): Promise<void> {
  const idPresign = await page.request.post("/api/worker/verification/upload", {
    data: { type: "id_document", contentType: "image/jpeg" },
  });
  expect(
    idPresign.ok(),
    `ID presign failed: ${idPresign.status()} ${await idPresign.text()}`
  ).toBeTruthy();
  const idBody = (await idPresign.json()) as { uploadUrl: string; key: string };
  const idPut = await page.request.put(idBody.uploadUrl, {
    headers: { "Content-Type": "image/jpeg" },
    data: JPEG_BYTES,
  });
  expect(idPut.ok(), `ID upload failed: ${idPut.status()}`).toBeTruthy();

  const challenge = await page.request.post(
    "/api/worker/verification/challenge",
    { data: { idDocumentKey: idBody.key } }
  );
  expect(
    challenge.ok(),
    `Challenge failed: ${challenge.status()} ${await challenge.text()}`
  ).toBeTruthy();

  const livePresign = await page.request.post(
    "/api/worker/verification/upload",
    {
      data: {
        type: "liveness_video",
        contentType: "video/mp4",
        idDocumentKey: idBody.key,
      },
    }
  );
  expect(
    livePresign.ok(),
    `Liveness presign failed: ${livePresign.status()} ${await livePresign.text()}`
  ).toBeTruthy();
  const liveBody = (await livePresign.json()) as {
    uploadUrl: string;
    key: string;
  };
  const livePut = await page.request.put(liveBody.uploadUrl, {
    headers: { "Content-Type": "video/mp4" },
    data: MP4_BYTES,
  });
  expect(
    livePut.ok(),
    `Liveness upload failed: ${livePut.status()}`
  ).toBeTruthy();

  const submit = await page.request.post("/api/worker/verification", {
    data: {
      idDocumentKey: idBody.key,
      livenessVideoKey: liveBody.key,
      docType: "passport",
    },
  });
  expect(
    submit.ok(),
    `Verification submit failed: ${submit.status()} ${await submit.text()}`
  ).toBeTruthy();
}

async function adminApproveIdentity(
  page: Page,
  profileId: string
): Promise<void> {
  const response = await page.request.post(
    `/api/admin/workers/${profileId}/verify`,
    { data: { action: "approve", docType: "passport" } }
  );
  expect(
    response.ok(),
    `Admin identity approve failed: ${response.status()} ${await response.text()}`
  ).toBeTruthy();
}

async function adminApproveVisiblePhoto(
  page: Page,
  workerEmail: string,
  expectedKind: "primary" | "gallery"
): Promise<void> {
  await page.goto("/admin/photos");
  await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("heading", { name: "Photo moderation" })
  ).toBeVisible();

  const pending = await page.request.get("/api/admin/photos/pending");
  expect(pending.ok()).toBeTruthy();
  const pendingBody = (await pending.json()) as {
    photos?: Array<{
      id: string;
      submissionKind?: "primary" | "gallery";
      worker: { email: string | null };
    }>;
  };
  const mine = (pendingBody.photos ?? []).filter(
    (photo) => photo.worker.email === workerEmail
  );
  expect(mine.length, JSON.stringify(mine)).toBeGreaterThan(0);
  expect(mine[0]?.submissionKind).toBe(expectedKind);

  const card = page
    .getByRole("main")
    .getByTestId("pending-photo-card")
    .filter({ hasText: workerEmail })
    .first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(
    card.getByTestId(`photo-submission-${expectedKind}`)
  ).toBeVisible();
  const review = card.getByRole("button", { name: "Review photo" });
  if (await review.count()) {
    await review.click();
  }
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Decision saved.")).toBeVisible({
    timeout: 20000,
  });
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
  test.describe.configure({ mode: "serial" });
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

  test("worker photo list never leaks stagingKey", async ({ page }) => {
    await signInAs(page, WORKER_EMAIL, "/worker/profile");
    const photos = await page.request.get("/api/worker/photos");
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
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Photo moderation" })
    ).toBeVisible();
    await expect(page.getByText(/Lingerie OK/i)).toHaveCount(0);
    await expect(
      page
        .getByRole("main")
        .getByText("Photos stay private until you approve them.")
    ).toBeVisible();
  });

  test("worker primary stays private until admin photo approval, then gallery and make-primary work", async ({
    browser,
  }) => {
    test.setTimeout(180_000);

    const worker = await openRole(browser, WORKER_EMAIL, "/worker/profile");
    const recruiter = await openRole(
      browser,
      RECRUITER_EMAIL,
      "/recruiter/dashboard"
    );
    const admin = await openRole(browser, ADMIN_EMAIL, "/admin/photos");

    try {
      const uploadCapture = attachUploadStageCapture(worker.page);
      const uploadFailed = worker.page.getByText(
        "We couldn't upload your photo. Please try again."
      );
      const dumpUploadCapture = (): void => {
        console.error(
          "[e2e photo upload] stage capture",
          JSON.stringify({
            origin: uploadCapture.origin(),
            events: uploadCapture.events,
          })
        );
      };

      await expect(worker.page.getByTestId("upload-primary-photo")).toBeVisible();
      await uploadJpeg(worker.page, "upload-primary-photo", "primary.jpg");
      const pendingPrimaryCopy = worker.page.getByText(
        "This photo will appear on your profile after it is approved."
      );
      try {
        await expect(pendingPrimaryCopy.or(uploadFailed).first()).toBeVisible({
          timeout: 30000,
        });
      } catch (error) {
        dumpUploadCapture();
        throw error;
      }
      if (await uploadFailed.isVisible()) {
        dumpUploadCapture();
      }
      await expect(pendingPrimaryCopy.first()).toBeVisible();
      await worker.page.reload();
      await expect(
        worker.page.getByTestId("photo-status-pending-review")
      ).toBeVisible();
      await expect(
        worker.page.getByTestId("add-gallery-photo")
      ).toHaveCount(0);
      await expect(
        worker.page.getByText(
          "Additional photos are available after your primary photo is approved."
        )
      ).toHaveCount(0);

      const profile = await workerProfile(worker.page);
      expect(profile.photoKey).toBeNull();
      expect(profile.photoUrl).toBeNull();
      const photosAfterPrimary = await ownedPhotos(worker.page);
      expect(photosAfterPrimary.canAddGalleryPhoto).toBe(false);
      expect(photosAfterPrimary.hasApprovedPrimaryPhoto).toBe(false);
      expect(photosAfterPrimary.photos).toHaveLength(1);
      const pendingPrimary = photosAfterPrimary.photos[0];
      expect(pendingPrimary.moderationStatus).toBe("pending");
      expect(pendingPrimary.photoUrl).toBeNull();
      expect(pendingPrimary.previewUrl).toBeTruthy();
      expect(pendingPrimary).not.toHaveProperty("stagingKey");

      expect(await recruiterSearchHasWorker(recruiter.page, profile.id)).toBe(
        false
      );
      expect(
        (await recruiterWorkerDetail(recruiter.page, profile.id)).status
      ).toBe(404);
      const recruiterPreview = await recruiter.page.request.get(
        `/api/worker/photos/${pendingPrimary.id}/preview`
      );
      expect(recruiterPreview.status()).toBeGreaterThanOrEqual(401);

      await submitIdentityForReview(worker.page);
      await adminApproveIdentity(admin.page, profile.id);

      const afterIdentity = await workerProfile(worker.page);
      expect(afterIdentity.verificationStatus).toBe("verified");
      expect(afterIdentity.photoKey).toBeNull();
      expect(afterIdentity.photoUrl).toBeNull();
      expect(
        (await recruiterWorkerDetail(recruiter.page, profile.id)).status
      ).toBe(404);
      expect((await ownedPhotos(worker.page)).canAddGalleryPhoto).toBe(false);

      await worker.page.reload();
      await expect(
        worker.page.getByText(
          "Additional photos are available after your primary photo is approved."
        )
      ).toBeVisible();
      await expect(worker.page.getByTestId("add-gallery-photo")).toHaveCount(0);

      await adminApproveVisiblePhoto(admin.page, WORKER_EMAIL, "primary");

      const afterPhotoApproval = await workerProfile(worker.page);
      expect(afterPhotoApproval.photoKey).toBeTruthy();
      expect(afterPhotoApproval.photoUrl).toBeTruthy();
      const recruiterAfterPrimary = await recruiterWorkerDetail(
        recruiter.page,
        profile.id
      );
      expect(recruiterAfterPrimary.status).toBe(200);
      expect(recruiterAfterPrimary.profile?.photos).toHaveLength(1);
      expect(recruiterAfterPrimary.profile?.photoUrl).toBe(
        afterPhotoApproval.photoUrl
      );
      const originalPrimaryUrl = afterPhotoApproval.photoUrl;

      await worker.page.reload();
      await expect(worker.page.getByTestId("add-gallery-photo")).toBeVisible();
      await uploadJpeg(worker.page, "add-gallery-photo", "gallery.jpg");
      await expect(
        worker.page.getByTestId("photo-status-pending-review")
      ).toBeVisible({ timeout: 30000 });

      const photosWithGallery = await ownedPhotos(worker.page);
      const pendingGallery = photosWithGallery.photos.find(
        (photo) => photo.moderationStatus === "pending"
      );
      expect(pendingGallery).toBeTruthy();
      const stillPrimary = await workerProfile(worker.page);
      expect(stillPrimary.photoUrl).toBe(originalPrimaryUrl);
      const recruiterDuringGallery = await recruiterWorkerDetail(
        recruiter.page,
        profile.id
      );
      expect(recruiterDuringGallery.profile?.photos).toHaveLength(1);

      await adminApproveVisiblePhoto(admin.page, WORKER_EMAIL, "gallery");

      const recruiterAfterGallery = await recruiterWorkerDetail(
        recruiter.page,
        profile.id
      );
      expect(recruiterAfterGallery.profile?.photos).toHaveLength(2);
      expect(recruiterAfterGallery.profile?.photoUrl).toBe(originalPrimaryUrl);
      expect(recruiterAfterGallery.profile?.photos[0]?.isCurrentApproved).toBe(
        true
      );

      await worker.page.reload();
      await expect(
        worker.page.getByRole("button", { name: "Make primary" })
      ).toBeVisible({ timeout: 15000 });
      const makePrimaryResponse = worker.page.waitForResponse(
        (response) =>
          response.url().includes("/api/worker/photos/") &&
          response.request().method() === "PATCH"
      );
      await worker.page.getByRole("button", { name: "Make primary" }).click();
      expect((await makePrimaryResponse).ok()).toBeTruthy();

      await expect
        .poll(async () => (await workerProfile(worker.page)).photoUrl)
        .not.toBe(originalPrimaryUrl);

      const recruiterAfterSwitch = await recruiterWorkerDetail(
        recruiter.page,
        profile.id
      );
      expect(recruiterAfterSwitch.profile?.photos).toHaveLength(2);
      expect(recruiterAfterSwitch.profile?.photoUrl).not.toBe(originalPrimaryUrl);
      expect(recruiterAfterSwitch.profile?.photos[0]?.isCurrentApproved).toBe(
        true
      );
      expect(
        recruiterAfterSwitch.profile?.photos.some(
          (photo) =>
            photo.photoUrl === originalPrimaryUrl && !photo.isCurrentApproved
        )
      ).toBe(true);
    } finally {
      await worker.context.close();
      await recruiter.context.close();
      await admin.context.close();
    }
  });
});
