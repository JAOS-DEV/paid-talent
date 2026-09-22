import { describe, expect, it } from "vitest";
import { resolveLocale } from "../locale";

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
