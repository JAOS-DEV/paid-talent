import { describe, expect, it } from "vitest";
import { localeFromCookieHeader, resolveLocale } from "@/lib/i18n/locale";

describe("resolveLocale", () => {
  it("keeps English as the default when no preference is stored", () => {
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale("")).toBe("en");
  });

  it("accepts the supported Thai locale", () => {
    expect(resolveLocale("th")).toBe("th");
    expect(resolveLocale("en")).toBe("en");
  });

  it("ignores unknown locale values", () => {
    expect(resolveLocale("fr")).toBe("en");
    expect(resolveLocale("thai")).toBe("en");
  });
});

describe("localeFromCookieHeader", () => {
  it("falls back when the cookie value is not valid URI encoding", () => {
    expect(localeFromCookieHeader("NEXT_LOCALE=%E0%A4%A")).toBe("en");
  });

  it("reads a valid locale cookie", () => {
    expect(localeFromCookieHeader("NEXT_LOCALE=th")).toBe("th");
  });
});
