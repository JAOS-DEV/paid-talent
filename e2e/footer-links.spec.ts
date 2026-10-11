import { test, expect } from "@playwright/test";

const FOOTER_PATHS = [
  "/auth/age-gate?role=worker",
  "/how-it-works",
  "/auth/age-gate?role=recruiter",
  "/top-talent",
  "/privacy",
  "/terms",
] as const;

test.describe("Footer links", () => {
  test("every footer destination returns 200", async ({ page, request }) => {
    await page.goto("/");

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(
      footer.getByRole("link", { name: /how it works/i })
    ).toBeVisible();

    const hrefs = await footer.locator("a[href]").evaluateAll((anchors) =>
      anchors
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href): href is string => !!href && href.startsWith("/"))
    );

    expect(hrefs.length).toBeGreaterThan(0);

    for (const expected of FOOTER_PATHS) {
      expect(hrefs).toContain(expected);
    }

    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), `Expected 200 for ${href}`).toBe(200);
    }
  });
});
