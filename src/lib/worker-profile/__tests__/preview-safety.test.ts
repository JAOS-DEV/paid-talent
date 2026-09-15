import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("worker recruiter preview architecture", () => {
  it("does not record a profile view from the preview route or query", () => {
    const previewRoute = readFileSync(
      path.join(process.cwd(), "src/app/api/worker/profile/preview/route.ts"),
      "utf8"
    );
    const previewQuery = readFileSync(
      path.join(process.cwd(), "src/lib/worker-profile/preview.ts"),
      "utf8"
    );
    const recruiterRoute = readFileSync(
      path.join(process.cwd(), "src/app/api/workers/[id]/route.ts"),
      "utf8"
    );

    expect(previewRoute).toContain("requireActiveWorker");
    expect(previewRoute).not.toContain("recordProfileView");
    expect(previewQuery).not.toContain("recordProfileView");
    expect(recruiterRoute).toContain("recordProfileView");
    expect(recruiterRoute).toContain("requireActiveRecruiter");
  });

  it("keeps recruiter hire actions off the worker preview page", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src/app/worker/profile/preview/page.tsx"),
      "utf8"
    );
    expect(page).toContain("mode=\"preview\"");
    expect(page).not.toContain("I'm Interested");
    expect(page).not.toContain("HireOutcomeActions");
    expect(page).not.toContain("/api/workers/");
  });
});
