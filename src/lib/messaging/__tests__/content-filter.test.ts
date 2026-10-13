import { describe, expect, it } from "vitest";
import {
  detectContactInfo,
  detectRiskKeywords,
  filterOutgoingText,
} from "../content-filter";

describe("content-filter", () => {
  const openerMustBlock = [
    "line neonbar99",
    "lineid neonbar99",
    "ไลน์: neonbar",
    "แอดไลน์ neonbar99",
    "แอดไลน์neonbar99",
    "add me on line abc123",
    "081 234 5678",
    "๐๘๑๒๓๔๕๖๗๘",
    "@neonbar99",
    "wa.me/66812345678",
    "0812345678",
    "zero eight one two three four five six seven eight",
    "ศูนย์แปดหนึ่งสองสามสี่ห้าหกเจ็ดแปด",
    "+66 81 234 5678",
    "line: neonbar",
    "line id neonbar",
    "ไลน์ neonbar99",
    "ไอดี abc_12",
    "my line is neonbar99",
    "t.me/abc",
    "https://x.com",
    "neonbar.com",
    "ig: neonbar",
    "me@mail.com",
  ];

  it.each(openerMustBlock)("opener blocks contact info in: %s", (sample) => {
    expect(detectContactInfo(sample, "opener").blocked).toBe(true);
    expect(
      filterOutgoingText(sample, { maxChars: 2000, context: "opener" }).ok
    ).toBe(false);
  });

  const openerMustAllow = [
    "the line was long",
    "I'm a line cook",
    "front line staff",
    "8 pm",
    "1500 baht",
    "I can start at 8 pm",
    "1500 baht per night",
    "shift 20:00-02:00",
    "see you on 12/10",
    "I am 25",
    "I'm on Sukhumvit",
    "call me on the line tomorrow",
  ];

  it.each(openerMustAllow)("opener allows safe text: %s", (sample) => {
    expect(detectContactInfo(sample, "opener").blocked).toBe(false);
    expect(
      filterOutgoingText(sample, { maxChars: 2000, context: "opener" }).ok
    ).toBe(true);
  });

  it("chat allows contact details, returns nudge and types", () => {
    for (const sample of ["my line is neonbar99", "081 234 5678"]) {
      const result = filterOutgoingText(sample, {
        maxChars: 2000,
        context: "chat",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.nudge).toBe("use_share_button");
      expect(result.contactTypes?.length).toBeGreaterThan(0);
    }
  });

  it("follow_up blocks the same as opener", () => {
    const result = filterOutgoingText("line neonbar99", {
      maxChars: 2000,
      context: "follow_up",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("contact_info_blocked");
  });

  it("flags online casino without contact block", () => {
    expect(detectContactInfo("online casino job", "chat").blocked).toBe(false);
    expect(detectRiskKeywords("online casino job").categories).toContain(
      "scam_work"
    );
  });

  it("flags risk keywords without blocking", () => {
    expect(detectRiskKeywords("please pay a deposit").categories).toContain(
      "money_request"
    );
    expect(detectRiskKeywords("เราจะเก็บพาสปอร์ตไว้").categories).toContain(
      "documents"
    );
    expect(
      detectRiskKeywords("job in Dubai, flight ticket paid").categories
    ).toContain("overseas");
    expect(detectRiskKeywords("งานที่กัมพูชา").categories).toContain(
      "overseas"
    );
    expect(detectRiskKeywords("I'm on Sukhumvit").categories).toHaveLength(0);
  });
});
