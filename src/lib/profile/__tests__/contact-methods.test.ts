import { describe, expect, it } from "vitest";
import { normalizeAndValidateContactMethods } from "../contact-methods";

describe("contact methods", () => {
  it("stores valid LINE, WhatsApp, and phone values", () => {
    const result = normalizeAndValidateContactMethods({
      lineId: " somchai_pattaya ",
      whatsappNumber: "+66812345678",
      phoneNumber: "0812345678",
    });

    expect(result).toEqual({
      ok: true,
      contact: {
        lineId: "somchai_pattaya",
        whatsappNumber: "+66812345678",
        phoneNumber: "0812345678",
      },
    });
  });

  it("does not apply public-text contact blocking to designated fields", () => {
    const result = normalizeAndValidateContactMethods({
      lineId: "abc123",
      whatsappNumber: "+66812345678",
      phoneNumber: "0812345678",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects oversized or invalid contact values", () => {
    expect(
      normalizeAndValidateContactMethods({
        lineId: "a".repeat(33),
      }).ok
    ).toBe(false);
    expect(
      normalizeAndValidateContactMethods({
        phoneNumber: "123",
      }).ok
    ).toBe(false);
  });
});
