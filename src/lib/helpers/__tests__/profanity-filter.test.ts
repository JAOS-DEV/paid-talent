import { describe, expect, it } from "vitest";
import {
  containsProfanity,
  detectProfanity,
  PROFANITY_BLOCKED_MESSAGE,
} from "../profanity-filter";

describe("profanity filter", () => {
  it("allows ordinary professional language", () => {
    expect(
      containsProfanity("Experienced bartender looking for full-time work")
    ).toBe(false);
  });

  it("detects common explicit English profanity", () => {
    expect(containsProfanity("fuck")).toBe(true);
    expect(containsProfanity("fucking")).toBe(true);
    expect(containsProfanity("cunt")).toBe(true);
  });

  it("handles case variations", () => {
    expect(containsProfanity("FUCK OFF")).toBe(true);
    expect(containsProfanity("FuCk")).toBe(true);
    expect(containsProfanity("Cunt")).toBe(true);
  });

  it("handles obvious separator and leet bypasses", () => {
    expect(containsProfanity("f.u.c.k")).toBe(true);
    expect(containsProfanity("f*ck")).toBe(true);
    expect(containsProfanity("f_u_c_k")).toBe(true);
  });

  it("does not flag ordinary words such as classic or count", () => {
    expect(containsProfanity("classic cocktail service")).toBe(false);
    expect(containsProfanity("I can count inventory")).toBe(false);
    expect(containsProfanity("Scunthorpe")).toBe(false);
  });

  it("returns matches without claiming Thai coverage", () => {
    const result = detectProfanity("fuck off cunt");
    expect(result.containsProfanity).toBe(true);
    expect(result.matches.every((match) => match.locale === "en")).toBe(true);
    expect(detectProfanity("fuck", "th" as "en")).toEqual({
      containsProfanity: false,
      matches: [],
    });
    expect(PROFANITY_BLOCKED_MESSAGE).toContain("isn't allowed");
  });
});
