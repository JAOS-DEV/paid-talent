import { describe, expect, it } from "vitest";
import {
  detectContactInfo,
  detectRiskKeywords,
  filterOutgoingText,
} from "../content-filter";

describe("content-filter", () => {
  const mustBlock = [
    "0812345678",
    "081 234 5678",
    "๐๘๑-๒๓๔-๕๖๗๘",
    "zero eight one two three four five six seven eight",
    "ศูนย์แปดหนึ่งสองสามสี่ห้าหกเจ็ดแปด",
    "+66 81 234 5678",
    "line: neonbar",
    "line id neonbar",
    "ไลน์ neonbar99",
    "ไอดี abc_12",
    "add me on line abc123",
    "my line is neonbar99",
    "wa.me/66812345678",
    "t.me/abc",
    "https://x.com",
    "neonbar.com",
    "@neonbar",
    "ig: neonbar",
    "me@mail.com",
  ];

  it.each(mustBlock)("blocks contact info in: %s", (sample) => {
    expect(detectContactInfo(sample).blocked).toBe(true);
    expect(filterOutgoingText(sample, { maxChars: 2000 }).ok).toBe(false);
  });

  const mustAllow = [
    "I can start at 8 pm",
    "1500 baht per night",
    "shift 20:00-02:00",
    "see you on 12/10",
    "I am 25",
    "I'm on Sukhumvit",
    "the line was long",
    "call me on the line tomorrow",
    "I'm a line cook",
    "front line staff",
  ];

  it.each(mustAllow)("allows safe text: %s", (sample) => {
    expect(detectContactInfo(sample).blocked).toBe(false);
  });

  it("flags online casino without contact block", () => {
    expect(detectContactInfo("online casino job").blocked).toBe(false);
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
