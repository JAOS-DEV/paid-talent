import { describe, expect, it } from "vitest";
import { parseVenueLink } from "../link";

describe("parseVenueLink", () => {
  it("accepts maps.app.goo.gl short links", () => {
    const result = parseVenueLink("https://maps.app.goo.gl/xxxx");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("google_maps");
      expect(result.normalizedUrl).toBe("https://maps.app.goo.gl/xxxx");
    }
  });

  it("accepts google.com/maps place URLs", () => {
    const result = parseVenueLink(
      "https://www.google.com/maps/place/Some+Bar/@13.7,100.5,17z"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("google_maps");
      expect(result.normalizedUrl).toContain("google.com/maps/place/");
    }
  });

  it("accepts facebook page URLs", () => {
    const result = parseVenueLink("https://www.facebook.com/somebar");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("facebook");
    }
  });

  it("accepts instagram URLs and strips igshid tracking", () => {
    const result = parseVenueLink(
      "https://instagram.com/somebar?igshid=abc123&utm_source=share"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("instagram");
      expect(result.normalizedUrl).not.toContain("igshid");
      expect(result.normalizedUrl).not.toContain("utm_source");
      expect(result.normalizedUrl).toContain("instagram.com/somebar");
    }
  });

  it("strips fbclid and utm params from facebook links", () => {
    const result = parseVenueLink(
      "https://www.facebook.com/somebar?fbclid=IwAR123&utm_campaign=x"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedUrl).not.toContain("fbclid");
      expect(result.normalizedUrl).not.toContain("utm_campaign");
    }
  });

  it("rejects http URLs", () => {
    const result = parseVenueLink("http://www.facebook.com/somebar");
    expect(result.ok).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    const result = parseVenueLink("javascript:alert(1)");
    expect(result.ok).toBe(false);
  });

  it("rejects other hosts", () => {
    const result = parseVenueLink("https://twitter.com/somebar");
    expect(result.ok).toBe(false);
  });

  it("rejects look-alike hosts", () => {
    const result = parseVenueLink("https://facebook.com.evil.io/somebar");
    expect(result.ok).toBe(false);
  });

  it("rejects empty string as missing", () => {
    const result = parseVenueLink("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/required/i);
    }
  });

  it("accepts m.facebook.com and fb.com", () => {
    expect(parseVenueLink("https://m.facebook.com/somebar").ok).toBe(true);
    expect(parseVenueLink("https://fb.com/somebar").ok).toBe(true);
  });
});
