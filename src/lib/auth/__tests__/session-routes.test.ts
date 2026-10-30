import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isProtectedAppRoute,
  isPublicAuthRoute,
} from "@/lib/auth/middleware-gate";

/**
 * A page guards itself only when a missing session redirects to sign-in
 * or calls notFound(). Calling auth() alone does not count.
 * requireAdminPage redirects unauthenticated visitors and calls notFound()
 * for everyone else who is not an admin.
 */
function pageGuardsMissingSession(source: string): boolean {
  if (/\brequireAdminPage\s*\(/.test(source)) {
    return true;
  }

  const checksSession = /!\s*session\b/.test(source);
  const redirectsToSignIn = /redirect\s*\(\s*[`'"]\/auth\/signin/.test(source);
  const callsNotFound = /\bnotFound\s*\(/.test(source);

  return checksSession && (redirectsToSignIn || callsNotFound);
}

function collectPages(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "api") {
        continue;
      }
      found.push(...collectPages(full));
      continue;
    }
    if (entry.name === "page.tsx") {
      found.push(full);
    }
  }
  return found;
}

function routeFromPage(file: string): string {
  const appDir = path.join(process.cwd(), "src", "app");
  const relative = path.relative(appDir, file);
  const parts = relative
    .split(path.sep)
    .filter((part) => part !== "page.tsx" && !part.startsWith("("));
  if (parts.length === 0) {
    return "/";
  }
  return `/${parts.join("/")}`;
}

describe("session routes", () => {
  it("covers every app page with middleware or its own guard", () => {
    const pages = collectPages(path.join(process.cwd(), "src", "app"));
    const uncovered = pages
      .map((file) => ({
        route: routeFromPage(file),
        source: fs.readFileSync(file, "utf8"),
      }))
      .filter(
        ({ route, source }) =>
          !isPublicAuthRoute(route) &&
          !isProtectedAppRoute(route) &&
          !pageGuardsMissingSession(source)
      )
      .map(({ route }) => route);

    expect(uncovered).toEqual([]);
    expect(pages.length).toBeGreaterThan(10);
  });

  it("does not treat a bare auth() call as a page guard", () => {
    const source = `const session = await auth();\nreturn <Page />;`;
    expect(pageGuardsMissingSession(source)).toBe(false);
  });

  it("counts a missing-session redirect or notFound as a page guard", () => {
    expect(
      pageGuardsMissingSession(`if (!session) redirect("/auth/signin");`)
    ).toBe(true);
    expect(
      pageGuardsMissingSession(`if (!session?.user) {\n  notFound();\n}`)
    ).toBe(true);
  });
});
