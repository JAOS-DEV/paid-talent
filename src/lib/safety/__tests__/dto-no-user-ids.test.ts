import { describe, expect, it } from "vitest";
import type { ConversationDetail } from "@/lib/conversations/service";
import type { InboxContactRequestDto } from "@/lib/contact-requests/queries";
import type { WorkerVenueView } from "@/lib/interests/worker-display";

function assertNoUserIdKeys(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUserIdKeys(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      expect(key, `${path}.${key}`).not.toMatch(/userId/i);
      assertNoUserIdKeys(nested, `${path}.${key}`);
    }
  }
}

describe("safety DTO contracts hide user ids", () => {
  it("conversation detail JSON has no userId keys", () => {
    const conversation: ConversationDetail = {
      id: "c1",
      status: "open",
      contactRequestId: "cr1",
      counterpart: {
        displayName: "Venue",
        photoUrl: null,
        verifiedPro: true,
      },
      messages: [
        {
          id: "m1",
          kind: "text",
          body: "hi",
          isMine: true,
          createdAt: new Date().toISOString(),
        },
      ],
      safetyNotice: false,
      shareChannels: ["line"],
      messageMaxChars: 2000,
    };

    assertNoUserIdKeys(conversation);
  });

  it("inbox contact request JSON has no userId keys", () => {
    const request: InboxContactRequestDto = {
      id: "cr1",
      status: "pending",
      isPro: false,
      openerText: "hello",
      followUpText: null,
      followUpSentAt: null,
      deliveredAt: null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
      recruiterFirstName: "Ann",
      venue: {
        id: "v1",
        name: "Bar",
        logoUrl: null,
        linkUrl: null,
        linkApproved: false,
      },
      openingSummary: null,
      conversationId: null,
    };

    assertNoUserIdKeys(request);
  });

  it("venue view JSON has no userId keys", () => {
    const view: Extract<WorkerVenueView, { status: "ready" }> = {
      status: "ready",
      interestId: "i1",
      venueId: "v1",
      venueName: "Sky Bar",
      areaLabel: "Sukhumvit",
      blurb: null,
      logoUrl: null,
      publicVenueLinkUrl: null,
      publicVenueLinkLabel: null,
      openings: [],
    };

    assertNoUserIdKeys(view);
  });
});
