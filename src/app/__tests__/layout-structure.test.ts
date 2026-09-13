import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Root Layout Structure", () => {
  const layoutPath = path.join(process.cwd(), "src/app/layout.tsx");
  const layoutSource = fs.readFileSync(layoutPath, "utf-8");

  it("should export an html element", () => {
    expect(layoutSource).toMatch(/<html[\s\S]*?>/);
  });

  it("should export a body element", () => {
    expect(layoutSource).toMatch(/<body[\s\S]*?>/);
  });

  it("should NOT have a manual <head> tag (App Router manages head via Metadata API)", () => {
    const hasManualHead = /<head>[\s\S]*?<\/head>/.test(layoutSource);
    expect(hasManualHead).toBe(false);
  });

  it("should have body nested inside html", () => {
    const htmlMatch = layoutSource.match(/<html[\s\S]*?<\/html>/);
    expect(htmlMatch).not.toBeNull();
    if (htmlMatch) {
      expect(htmlMatch[0]).toMatch(/<body[\s\S]*?<\/body>/);
    }
  });
});

describe("Global Error Page Structure", () => {
  const globalErrorPath = path.join(process.cwd(), "src/app/global-error.tsx");
  const globalErrorSource = fs.readFileSync(globalErrorPath, "utf-8");

  it("should exist for proper error handling", () => {
    expect(fs.existsSync(globalErrorPath)).toBe(true);
  });

  it("should include its own html tag (required for global errors)", () => {
    expect(globalErrorSource).toMatch(/<html[\s\S]*?>/);
  });

  it("should include its own body tag (required for global errors)", () => {
    expect(globalErrorSource).toMatch(/<body[\s\S]*?>/);
  });

  it("should be a client component", () => {
    expect(globalErrorSource).toMatch(/["']use client["']/);
  });
});
