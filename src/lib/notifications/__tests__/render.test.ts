import { describe, expect, it } from "vitest";
import { renderNotification } from "../render";
import type { NotificationType } from "@/lib/db/schema";

const TYPES: NotificationType[] = [
  "contact_request_received",
  "contact_request_accepted",
  "contact_request_declined",
  "new_message",
  "contact_shared",
  "verification_approved",
  "verification_rejected",
  "venue_approved",
  "venue_rejected",
  "messaging_paused",
  "safety_notice",
];

const FORBIDDEN_KEYS = [
  "messageBody",
  "body",
  "openerText",
  "phone",
  "phoneNumber",
  "lineId",
  "whatsapp",
  "whatsappNumber",
  "email",
  "contactValue",
];

describe("renderNotification", () => {
  it("renders en and th subjects/text for every type", () => {
    for (const type of TYPES) {
      const payload = {
        recruiterName: "Ann",
        workerName: "Bee",
        venueName: "Sunrise",
        senderName: "Ann",
        sharerName: "Bee",
        conversationId: "11111111-1111-4111-8111-111111111111",
        contactRequestId: "22222222-2222-4222-8222-222222222222",
        venueId: "33333333-3333-4333-8333-333333333333",
      };

      const en = renderNotification(type, payload, "en", { role: "worker" });
      const th = renderNotification(type, payload, "th", { role: "worker" });

      expect(en.subject.length).toBeGreaterThan(0);
      expect(en.text.length).toBeGreaterThan(0);
      expect(en.url).toMatch(/^https?:\/\//);
      expect(th.subject.length).toBeGreaterThan(0);
      expect(th.text.length).toBeGreaterThan(0);
    }
  });

  it("never includes message bodies or contact values for every type (payload key property)", () => {
    for (const type of TYPES) {
      const payload: Record<string, string> = {
        recruiterName: "Ann",
        workerName: "Bee",
        venueName: "Sunrise",
        senderName: "Ann",
        sharerName: "Bee",
        conversationId: "c1",
        contactRequestId: "r1",
        venueId: "v1",
        messageBody: "SECRET_MESSAGE_BODY",
        body: "SECRET_BODY",
        openerText: "SECRET_OPENER",
        phone: "0812345678",
        phoneNumber: "+66812345678",
        lineId: "secret_line",
        whatsapp: "+66899999999",
        whatsappNumber: "+66899999999",
        email: "secret@example.com",
        contactValue: "do-not-leak",
      };

      for (const locale of ["en", "th"] as const) {
        const rendered = renderNotification(type, payload, locale);
        const blob = `${rendered.subject}\n${rendered.text}\n${rendered.url}`;
        for (const key of FORBIDDEN_KEYS) {
          expect(blob).not.toContain(payload[key]);
        }
      }
    }
  });

  it("allows venue name in email copy but not venue type words", () => {
    const rendered = renderNotification(
      "contact_request_received",
      {
        recruiterName: "Ann",
        venueName: "Neon Bar",
      },
      "en"
    );
    expect(rendered.text).toContain("Neon Bar");
    expect(rendered.text.toLowerCase()).not.toMatch(
      /\b(go-go|gogo|massage|karaoke|hostess club)\b/
    );
  });
});
