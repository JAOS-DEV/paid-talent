import { describe, expect, it } from "vitest";
import { localeFromCookieHeader } from "@/lib/i18n/locale";

describe("localeFromCookieHeader", () => {
  it("falls back when the cookie value is not valid URI encoding", () => {
    expect(localeFromCookieHeader("NEXT_LOCALE=%E0%A4%A")).toBe("en");
  });

  it("reads a valid locale cookie", () => {
    expect(localeFromCookieHeader("NEXT_LOCALE=th")).toBe("th");
  });
});
