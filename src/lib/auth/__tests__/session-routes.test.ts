import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isProtectedAppRoute,
  isPublicAuthRoute,
} from "@/lib/auth/middleware-gate";

const PAGE_GUARD =
  /requireAdminPage|auth\(|redirect\(\s*["']\/auth\/signin/;

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
          !PAGE_GUARD.test(source)
      )
      .map(({ route }) => route);

    expect(uncovered).toEqual([]);
    expect(pages.length).toBeGreaterThan(10);
  });
});
