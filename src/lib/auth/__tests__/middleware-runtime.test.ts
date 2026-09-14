import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getSessionHomePath,
  isAuthApiPath,
  middlewareMatcherHits,
  resolveRoleRouteRedirect,
} from "../middleware-paths";
import { resolveMiddlewareGate } from "../middleware-gate";

const SRC_ROOT = path.resolve(__dirname, "../../..");

function resolveImportSpecifier(
  fromFile: string,
  spec: string
): string | null {
  if (spec.startsWith("@/")) {
    return path.join(SRC_ROOT, spec.slice(2));
  }
  if (spec.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), spec);
  }
  return null;
}

function withExtension(file: string): string | null {
  const candidates = [
    file,
    `${file}.ts`,
    `${file}.tsx`,
    path.join(file, "index.ts"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function collectLocalImports(entry: string): string[] {
  const seen = new Set<string>();

  function walk(file: string): void {
    const abs = withExtension(file);
    if (!abs || seen.has(abs)) return;
    seen.add(abs);

    const source = fs.readFileSync(abs, "utf8");
    const importRe = /(?:^|\n)import(?!\s+type\b)[\s\S]*?from\s+["']([^"']+)["']/g;
    let match: RegExpExecArray | null = importRe.exec(source);
    while (match) {
      const resolved = resolveImportSpecifier(abs, match[1]);
      if (resolved) {
        walk(resolved);
      }
      match = importRe.exec(source);
    }
  }

  walk(entry);
  return [...seen].map((file) => file.replaceAll("\\", "/"));
}

function isNodeOrDbModule(file: string): boolean {
  return (
    file.includes("/lib/db/") ||
    file.endsWith("/lib/db.ts") ||
    file.includes("/lib/db/index.ts") ||
    file.includes("postgres") ||
    file.includes("nodemailer")
  );
}

describe("middleware runtime safety", () => {
  it("excludes /api/auth callback and session routes from the matcher", () => {
    expect(middlewareMatcherHits("/api/auth/callback/google")).toBe(false);
    expect(middlewareMatcherHits("/api/auth/callback/email")).toBe(false);
    expect(middlewareMatcherHits("/api/auth/session")).toBe(false);
    expect(middlewareMatcherHits("/api/auth/signin/google")).toBe(false);
    expect(middlewareMatcherHits("/api/auth/verify-age")).toBe(false);
    expect(isAuthApiPath("/api/auth/callback/google")).toBe(true);
  });

  it("still matches protected and public app routes", () => {
    expect(middlewareMatcherHits("/")).toBe(true);
    expect(middlewareMatcherHits("/auth/signin")).toBe(true);
    expect(middlewareMatcherHits("/worker/dashboard")).toBe(true);
    expect(middlewareMatcherHits("/recruiter/dashboard")).toBe(true);
    expect(middlewareMatcherHits("/api/media/upload")).toBe(true);
  });

  it("does not import database or Node-only modules from middleware", () => {
    const middlewareFile = path.join(SRC_ROOT, "middleware.ts");
    const imported = collectLocalImports(middlewareFile);
    const source = fs.readFileSync(middlewareFile, "utf8");

    expect(source).not.toContain("@/lib/db");
    expect(source).not.toMatch(/from ["']@\/lib\/auth["']/);
    expect(source).toContain("@/lib/auth/edge-config");
    expect(source).toContain("favicon.ico|api/auth|public");
    expect(imported.some(isNodeOrDbModule)).toBe(false);
    expect(imported.some((file) => file.endsWith("/lib/auth/config.ts"))).toBe(
      false
    );
  });

  it("edge auth config import graph stays free of DB and Node mailer code", () => {
    const imported = collectLocalImports(
      path.join(SRC_ROOT, "lib/auth/edge-config.ts")
    );

    expect(imported.some(isNodeOrDbModule)).toBe(false);
    expect(
      imported.some((file) => file.includes("next/headers"))
    ).toBe(false);
  });
});

describe("resolveRoleRouteRedirect", () => {
  it("sends recruiters away from worker routes", () => {
    expect(resolveRoleRouteRedirect("/worker/dashboard", "recruiter")).toBe(
      "/recruiter/dashboard"
    );
  });

  it("sends workers away from recruiter routes and search", () => {
    expect(resolveRoleRouteRedirect("/recruiter/dashboard", "worker")).toBe(
      "/worker/dashboard"
    );
    expect(resolveRoleRouteRedirect("/search", "worker")).toBe(
      "/worker/dashboard"
    );
  });

  it("allows matching roles to proceed", () => {
    expect(resolveRoleRouteRedirect("/worker/onboarding", "worker")).toBeNull();
    expect(resolveRoleRouteRedirect("/recruiter/openings", "recruiter")).toBeNull();
  });

  it("maps JWT role to a dashboard without a DB completeness lookup", () => {
    expect(getSessionHomePath("worker")).toBe("/worker/dashboard");
    expect(getSessionHomePath("recruiter")).toBe("/recruiter/dashboard");
  });
});

describe("auth callback gate", () => {
  it("allows /api/auth callback routes without a session so middleware cannot crash them", () => {
    expect(
      resolveMiddlewareGate({
        pathname: "/api/auth/callback/google",
        hasSession: false,
        ageVerified: false,
        isApiRoute: true,
        isAuthApiRoute: true,
      })
    ).toEqual({ action: "allow" });
  });
});
