import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import enMessages from "../../../../messages/en.json";

describe("worker dashboard incomplete-profile redirect removal", () => {
  const dashboardSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/worker/dashboard/page.tsx"),
    "utf-8"
  );
  const headerSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/layout/Header.tsx"),
    "utf-8"
  );
  const middlewareSource = fs.readFileSync(
    path.join(process.cwd(), "src/middleware.ts"),
    "utf-8"
  );
  const roleRoutesSource = fs.readFileSync(
    path.join(process.cwd(), "src/lib/auth/middleware-paths.ts"),
    "utf-8"
  );
  const onboardingSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/worker/onboarding/page.tsx"),
    "utf-8"
  );

  it("does not import or use INCOMPLETE_PROFILE_REDIRECT_THRESHOLD", () => {
    expect(dashboardSource).not.toMatch(/INCOMPLETE_PROFILE_REDIRECT_THRESHOLD/);
  });

  it("does not bounce incomplete workers back to onboarding", () => {
    expect(dashboardSource).not.toMatch(
      /router\.replace\(\s*["']\/worker\/onboarding["']\s*\)/
    );
  });

  it("Header Dashboard link always targets the worker dashboard for workers", () => {
    expect(headerSource).toMatch(/["']\/worker\/dashboard["']/);
    expect(headerSource).not.toMatch(/INCOMPLETE_PROFILE_REDIRECT_THRESHOLD/);
    expect(headerSource).not.toMatch(/getProfileCompleteness/);
  });

  it("Finish later still navigates to the worker dashboard", () => {
    expect(onboardingSource).toMatch(/ONBOARDING_FINISH_LATER_HREF/);
    expect(onboardingSource).toMatch(/t\("finishLater"\)/);
    expect(enMessages.worker.onboarding.finishLater).toBe("Finish later");
  });

  it("keeps worker/recruiter role protection in middleware", () => {
    expect(middlewareSource).toContain("resolveRoleRouteRedirect");
    expect(roleRoutesSource).toMatch(
      /isWorkerRoute && role !== ["']worker["']/
    );
    expect(roleRoutesSource).toMatch(
      /isRecruiterRoute && role !== ["']recruiter["']/
    );
  });

  it("keeps WorkerConfirmationCard on the worker dashboard", () => {
    expect(dashboardSource).toMatch(/WorkerConfirmationCard/);
    expect(dashboardSource).toMatch(/\/api\/worker\/dashboard/);
    expect(dashboardSource).not.toMatch(
      /\/api\/worker\/hire-confirmations\/pending/
    );
  });
});
