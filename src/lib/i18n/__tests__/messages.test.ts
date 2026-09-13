import { describe, it, expect } from "vitest";
import enMessages from "../../../../messages/en.json";
import thMessages from "../../../../messages/th.json";

function getMessageKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      keys.push(...getMessageKeys(obj[key] as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe("i18n messages", () => {
  describe("message file structure", () => {
    it("should have matching keys in en and th", () => {
      const enKeys = getMessageKeys(enMessages).sort();
      const thKeys = getMessageKeys(thMessages).sort();

      expect(enKeys).toEqual(thKeys);
    });

    it("should have non-empty values in en", () => {
      const enKeys = getMessageKeys(enMessages);
      for (const key of enKeys) {
        const value = key.split(".").reduce<unknown>((obj, k) => {
          return (obj as Record<string, unknown>)?.[k];
        }, enMessages);
        expect(value).toBeTruthy();
        expect(typeof value).toBe("string");
      }
    });

    it("should have non-empty values in th", () => {
      const thKeys = getMessageKeys(thMessages);
      for (const key of thKeys) {
        const value = key.split(".").reduce<unknown>((obj, k) => {
          return (obj as Record<string, unknown>)?.[k];
        }, thMessages);
        expect(value).toBeTruthy();
        expect(typeof value).toBe("string");
      }
    });
  });

  describe("common namespace", () => {
    it("should have loading key", () => {
      expect(enMessages.common.loading).toBe("Loading...");
      expect(thMessages.common.loading).toBe("กำลังโหลด...");
    });

    it("should have save key", () => {
      expect(enMessages.common.save).toBe("Save");
      expect(thMessages.common.save).toBe("บันทึก");
    });
  });

  describe("navigation namespace", () => {
    it("should have dashboard key", () => {
      expect(enMessages.navigation.dashboard).toBe("Dashboard");
      expect(thMessages.navigation.dashboard).toBe("แดชบอร์ด");
    });
  });

  describe("worker namespace", () => {
    it("should have verification keys", () => {
      expect(enMessages.worker.verification.title).toBe("Identity Verification");
      expect(thMessages.worker.verification.title).toBe("การยืนยันตัวตน");
    });
  });
});
