import { describe, it, expect } from "vitest";
import {
  detectBlockedContacts,
  containsBlockedContact,
  sanitizeProfileText,
  validateProfileText,
  getBlockedContactErrorMessage,
  type BlockedContactType,
} from "../text-filter";

describe("text-filter helpers", () => {
  describe("detectBlockedContacts", () => {
    describe("phone number detection", () => {
      it("should detect Thai mobile numbers starting with 08", () => {
        const result = detectBlockedContacts("Call me at 0812345678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect Thai mobile numbers starting with 09", () => {
        const result = detectBlockedContacts("My number is 0912345678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect Thai mobile numbers starting with 06", () => {
        const result = detectBlockedContacts("Reach me at 0612345678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect Thai mobile with dashes", () => {
        const result = detectBlockedContacts("081-234-5678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect Thai mobile with spaces", () => {
        const result = detectBlockedContacts("081 234 5678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect Thai mobile with dots", () => {
        const result = detectBlockedContacts("081.234.5678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect international format +66", () => {
        const result = detectBlockedContacts("Contact +66812345678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect international format +66 with spaces", () => {
        const result = detectBlockedContacts("+66 81 234 5678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect US numbers +1", () => {
        const result = detectBlockedContacts("Call +1 555 123 4567");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect UK numbers +44", () => {
        const result = detectBlockedContacts("+44 20 7123 4567");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect obfuscated phone with all spaces", () => {
        const result = detectBlockedContacts("0 8 1 2 3 4 5 6 7 8");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect international with spaced +66", () => {
        const result = detectBlockedContacts("+ 6 6 8 1 2 3 4 5 6 7 8");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });

      it("should detect Thai landline numbers", () => {
        const result = detectBlockedContacts("Office: 02-123-4567");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
      });
    });

    describe("LINE detection", () => {
      it("should detect line.me links", () => {
        const result = detectBlockedContacts("Add me at line.me/ti/p/abc123");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("line_id");
      });

      it("should detect LINE ID with colon format", () => {
        const result = detectBlockedContacts("LINE ID: mylineid123");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("line_id");
      });

      it("should detect LINE ID with @ format", () => {
        const result = detectBlockedContacts("LINE @mylineid");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("line_id");
      });

      it("should detect Thai LINE reference (ไลน์)", () => {
        const result = detectBlockedContacts("ไลน์: mylineid");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("line_id");
      });

      it("should detect add me on line pattern", () => {
        const result = detectBlockedContacts("add me on line myusername");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("line_id");
      });

      it("should detect contact me line pattern", () => {
        const result = detectBlockedContacts("contact me line: user123");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("line_id");
      });

      it("should NOT detect standalone word 'line' in normal context", () => {
        const result = detectBlockedContacts("I work on the front line of service.");
        expect(result.containsBlockedContact).toBe(false);
      });

      it("should NOT detect 'online' or 'deadline'", () => {
        const result = detectBlockedContacts("Available online. Meeting deadline tomorrow.");
        expect(result.containsBlockedContact).toBe(false);
      });
    });

    describe("WhatsApp detection", () => {
      it("should detect wa.me links", () => {
        const result = detectBlockedContacts("Chat at wa.me/66812345678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("whatsapp");
      });

      it("should detect whatsapp.com links", () => {
        const result = detectBlockedContacts("whatsapp.com/send?phone=66812345678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("whatsapp");
      });

      it("should detect WhatsApp: number format", () => {
        const result = detectBlockedContacts("WhatsApp: +66812345678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("whatsapp");
      });

      it("should detect WA number format", () => {
        const result = detectBlockedContacts("WA: 0812345678");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("whatsapp");
      });

      it("should detect contact me on whatsapp", () => {
        const result = detectBlockedContacts("contact me on whatsapp");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("whatsapp");
      });

      it("should NOT detect 'was' or 'want'", () => {
        const result = detectBlockedContacts("I was working here. I want to help.");
        expect(result.containsBlockedContact).toBe(false);
      });
    });

    describe("Telegram detection", () => {
      it("should detect t.me links", () => {
        const result = detectBlockedContacts("Join at t.me/myusername");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("telegram");
      });

      it("should detect telegram.me links", () => {
        const result = detectBlockedContacts("telegram.me/channel123");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("telegram");
      });

      it("should detect telegram username format", () => {
        const result = detectBlockedContacts("telegram: @myuser");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("telegram");
      });

      it("should detect tg: format", () => {
        const result = detectBlockedContacts("tg: @username123");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("telegram");
      });
    });

    describe("URL detection", () => {
      it("should detect http URLs", () => {
        const result = detectBlockedContacts("Visit http://example.com");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("url");
      });

      it("should detect https URLs", () => {
        const result = detectBlockedContacts("Check https://mysite.com/profile");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("url");
      });

      it("should detect www URLs", () => {
        const result = detectBlockedContacts("Go to www.mywebsite.com");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("url");
      });

      it("should detect Instagram URLs", () => {
        const result = detectBlockedContacts("instagram.com/myprofile");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("url");
      });

      it("should detect Facebook URLs", () => {
        const result = detectBlockedContacts("facebook.com/mypage");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("url");
      });

      it("should detect fb.com URLs", () => {
        const result = detectBlockedContacts("fb.com/user123");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("url");
      });

      it("should detect TikTok URLs", () => {
        const result = detectBlockedContacts("tiktok.com/@myhandle");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("url");
      });

      it("should detect YouTube URLs", () => {
        const result = detectBlockedContacts("youtube.com/channel/abc");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("url");
      });

      it("should detect youtu.be short URLs", () => {
        const result = detectBlockedContacts("youtu.be/abc123");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("url");
      });

      it("should detect Discord invite links", () => {
        const result = detectBlockedContacts("discord.gg/invite123");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("url");
      });
    });

    describe("social handle detection", () => {
      it("should detect IG: username format", () => {
        const result = detectBlockedContacts("IG: @myinstagram");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("social_handle");
      });

      it("should detect Instagram username mention", () => {
        const result = detectBlockedContacts("insta: myusername");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("social_handle");
      });

      it("should detect FB username format", () => {
        const result = detectBlockedContacts("FB: myprofile");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("social_handle");
      });

      it("should detect Twitter handle format", () => {
        const result = detectBlockedContacts("Twitter: @myhandle");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("social_handle");
      });

      it("should detect TikTok username", () => {
        const result = detectBlockedContacts("TikTok: @mytiktok");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("social_handle");
      });

      it("should detect @ handle with contact context", () => {
        const result = detectBlockedContacts("contact me @myhandle for work");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("social_handle");
      });

      it("should detect dm me @ format", () => {
        const result = detectBlockedContacts("DM me @username123");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("social_handle");
      });
    });

    describe("email detection", () => {
      it("should detect standard email format", () => {
        const result = detectBlockedContacts("Email me at user@example.com");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("email");
      });

      it("should detect email with subdomain", () => {
        const result = detectBlockedContacts("contact@mail.company.co.th");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("email");
      });

      it("should detect email with plus addressing", () => {
        const result = detectBlockedContacts("user+tag@gmail.com");
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("email");
      });
    });

    describe("false positive prevention", () => {
      it("should allow legitimate bio about experience", () => {
        const result = detectBlockedContacts(
          "I have 5 years of experience in hospitality. Fluent in English and Thai."
        );
        expect(result.containsBlockedContact).toBe(false);
      });

      it("should allow job descriptions without contact", () => {
        const result = detectBlockedContacts(
          "Professional bartender available for full-time or part-time positions."
        );
        expect(result.containsBlockedContact).toBe(false);
      });

      it("should allow normal names", () => {
        const result = detectBlockedContacts("Sarah Johnson");
        expect(result.containsBlockedContact).toBe(false);
      });

      it("should allow Thai names", () => {
        const result = detectBlockedContacts("สมชาย ใจดี");
        expect(result.containsBlockedContact).toBe(false);
      });

      it("should allow location descriptions", () => {
        const result = detectBlockedContacts(
          "Based in Bangkok, willing to travel to Phuket and Chiang Mai."
        );
        expect(result.containsBlockedContact).toBe(false);
      });

      it("should allow mentions of timeline and deadline", () => {
        const result = detectBlockedContacts(
          "I can meet any deadline. My timeline is flexible."
        );
        expect(result.containsBlockedContact).toBe(false);
      });

      it("should allow mentions of being online", () => {
        const result = detectBlockedContacts(
          "I am available online for interviews."
        );
        expect(result.containsBlockedContact).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should handle empty string", () => {
        const result = detectBlockedContacts("");
        expect(result.containsBlockedContact).toBe(false);
        expect(result.matches).toHaveLength(0);
      });

      it("should handle null-ish input", () => {
        const result = detectBlockedContacts(null as unknown as string);
        expect(result.containsBlockedContact).toBe(false);
      });

      it("should handle undefined input", () => {
        const result = detectBlockedContacts(undefined as unknown as string);
        expect(result.containsBlockedContact).toBe(false);
      });

      it("should detect multiple contact types in same text", () => {
        const result = detectBlockedContacts(
          "Call 0812345678 or LINE: myline or email me@test.com"
        );
        expect(result.containsBlockedContact).toBe(true);
        expect(result.reasons).toContain("phone_number");
        expect(result.reasons).toContain("line_id");
        expect(result.reasons).toContain("email");
      });

      it("should handle text with special characters", () => {
        const result = detectBlockedContacts("Bio with émojis 🎉 and spëcial chars!");
        expect(result.containsBlockedContact).toBe(false);
      });
    });
  });

  describe("containsBlockedContact", () => {
    it("should return true for text with blocked contact", () => {
      expect(containsBlockedContact("LINE ID: abc123")).toBe(true);
    });

    it("should return false for clean text", () => {
      expect(containsBlockedContact("Professional bartender")).toBe(false);
    });
  });

  describe("sanitizeProfileText", () => {
    it("should remove phone numbers", () => {
      const result = sanitizeProfileText("Contact me at 0812345678 for work");
      expect(result).toContain("[removed]");
      expect(result).not.toContain("0812345678");
    });

    it("should remove LINE IDs", () => {
      const result = sanitizeProfileText("My LINE ID: myuser123");
      expect(result).toContain("[removed]");
      expect(result).not.toContain("myuser123");
    });

    it("should remove URLs", () => {
      const result = sanitizeProfileText("Check my site https://example.com");
      expect(result).toContain("[removed]");
      expect(result).not.toContain("https://example.com");
    });

    it("should remove multiple blocked items", () => {
      const result = sanitizeProfileText(
        "Call 0812345678 or visit https://mysite.com"
      );
      expect(result.match(/\[removed\]/g)?.length).toBe(2);
    });

    it("should leave clean text unchanged", () => {
      const text = "Experienced bartender looking for work";
      expect(sanitizeProfileText(text)).toBe(text);
    });

    it("should handle empty string", () => {
      expect(sanitizeProfileText("")).toBe("");
    });

    it("should handle null input", () => {
      expect(sanitizeProfileText(null as unknown as string)).toBe(null);
    });
  });

  describe("validateProfileText", () => {
    it("should return null for valid text", () => {
      expect(validateProfileText("Professional looking for work")).toBeNull();
    });

    it("should return error for phone number", () => {
      const error = validateProfileText("Call 0812345678");
      expect(error).not.toBeNull();
      expect(error?.type).toBe("blocked_contact");
      expect(error?.reasons).toContain("phone_number");
    });

    it("should return error for LINE ID", () => {
      const error = validateProfileText("LINE: myid123");
      expect(error).not.toBeNull();
      expect(error?.reasons).toContain("line_id");
    });

    it("should return descriptive message for single type", () => {
      const error = validateProfileText("wa.me/123456");
      expect(error?.message).toContain("WhatsApp");
      expect(error?.message).toContain("designated contact fields");
    });

    it("should return combined message for multiple types", () => {
      const error = validateProfileText("Call 0812345678 or LINE: myid");
      expect(error?.message).toContain("contact information");
    });

    it("should handle empty string", () => {
      expect(validateProfileText("")).toBeNull();
    });
  });

  describe("getBlockedContactErrorMessage", () => {
    it("should return single type message", () => {
      const message = getBlockedContactErrorMessage(["phone_number"]);
      expect(message).toContain("phone numbers");
    });

    it("should return multi-type message", () => {
      const message = getBlockedContactErrorMessage(["phone_number", "line_id"]);
      expect(message).toContain("phone numbers");
      expect(message).toContain("LINE IDs");
    });

    it("should handle empty reasons", () => {
      const message = getBlockedContactErrorMessage([]);
      expect(message).toBe("Profile text contains blocked content.");
    });

    it("should handle all contact types", () => {
      const allTypes: BlockedContactType[] = [
        "phone_number",
        "line_id",
        "whatsapp",
        "telegram",
        "url",
        "social_handle",
        "email",
      ];
      const message = getBlockedContactErrorMessage(allTypes);
      expect(message).toContain("contact section");
    });
  });

  describe("obfuscation detection", () => {
    it("should detect phone with letter O substitution", () => {
      const result = detectBlockedContacts("O81234567O");
      expect(result.containsBlockedContact).toBe(true);
    });

    it("should detect written number pattern zero eight", () => {
      const result = detectBlockedContacts("call me zero eight one two three four five six seven eight");
      expect(result.containsBlockedContact).toBe(true);
      expect(result.reasons).toContain("phone_number");
    });

    it("should detect spaced international number", () => {
      const result = detectBlockedContacts("+ 6 6 8 1 2 3 4 5 6 7 8");
      expect(result.containsBlockedContact).toBe(true);
    });

    it("should detect parentheses format", () => {
      const result = detectBlockedContacts("(081) 234-5678");
      expect(result.containsBlockedContact).toBe(true);
    });
  });
});
