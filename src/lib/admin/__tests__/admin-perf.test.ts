import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(process.cwd(), "src");

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), "utf8");
}

describe("admin performance architecture", () => {
  it("does not loop isProfileTopTalent when computing overview metrics", () => {
    const source = readSrc("lib/admin/overview-metrics.ts");
    expect(source).not.toContain("isProfileTopTalent");
    expect(source).toContain("countPublishedTopTalent");
    expect(source).toContain("filter (where");
  });

  it("disables eager prefetch on heavy admin navigation", () => {
    const nav = readSrc("components/admin/AdminNav.tsx");
    expect(nav).toMatch(/href=\{item\.href\}\s+prefetch=\{false\}/);

    const header = readSrc("components/layout/Header.tsx");
    expect(header).toContain('href="/admin"');
    expect(header).toContain("prefetch={false}");
  });

  it("loads verification and photo queues without eager signed media", () => {
    expect(readSrc("app/admin/verifications/page.tsx")).toContain(
      "includeSignedMedia: false"
    );
    expect(readSrc("app/admin/photos/page.tsx")).toContain(
      "includeSignedMedia: false"
    );
    expect(readSrc("app/api/admin/workers/pending/route.ts")).toContain(
      "includeSignedMedia: false"
    );
    expect(readSrc("app/api/admin/photos/pending/route.ts")).toContain(
      "includeSignedMedia: false"
    );
    expect(readSrc("components/admin/VerificationQueue.tsx")).toContain(
      "/api/admin/workers/${worker.id}/media"
    );
    expect(readSrc("components/admin/PhotoQueue.tsx")).toContain(
      "/api/admin/photos/${photo.id}/media"
    );
  });

  it("keeps lazy moderation media routes admin-only", () => {
    const workerMedia = readSrc("app/api/admin/workers/[id]/media/route.ts");
    const photoMedia = readSrc("app/api/admin/photos/[id]/media/route.ts");
    for (const source of [workerMedia, photoMedia]) {
      expect(source).toContain("requireAdminApi");
      expect(source).not.toContain("idDocumentKey");
      expect(source).not.toContain("stagingKey");
      expect(source).not.toContain("livenessVideoKey");
    }
  });

  it("adds immediate admin loading feedback without wrapping auth in the layout fetch", () => {
    const loading = readSrc("app/admin/loading.tsx");
    expect(loading).toContain("Loading admin page");
    expect(loading).toContain("animate-pulse");
  });

  it("keeps the header from rendering an oversized Admin Dashboard control", () => {
    const header = readSrc("components/layout/Header.tsx");
    expect(header).not.toContain("Admin Dashboard");
    expect(header).not.toContain("needsMobileMenu");
    expect(header).not.toContain("account-mobile-nav");
    expect(header).toContain("h-14");
    expect(header).toContain("h-8");
    expect(header).toContain("overflow-x-hidden");
  });
});
