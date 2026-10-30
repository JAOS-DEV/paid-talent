import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SendContactRequestDialog } from "../SendContactRequestDialog";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === "dialog.remaining" && values) {
      return `${values.daily} left today · ${values.weekly} left this week`;
    }
    if (key === "errors.dailyLimit" && values) {
      return `You've used your ${values.count} requests today. Resets in ${values.hours}h.`;
    }
    return key;
  },
}));

describe("SendContactRequestDialog", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("/api/contact-requests/limits")) {
          return {
            ok: true,
            json: async () => ({
              access: {
                tier: "free",
                approvedVenueIds: ["venue-1"],
                primaryVenueId: "venue-1",
                isVerified: true,
              },
              limits: {
                openerMaxChars: 300,
                canAttachOpening: false,
                remainingDaily: 2,
                remainingWeekly: 8,
                dailyNew: 3,
                weeklyNew: 10,
              },
            }),
          };
        }
        if (url.includes("/api/recruiter/venues")) {
          return {
            ok: true,
            json: async () => ({
              venues: [
                {
                  id: "venue-1",
                  name: "Primary Venue",
                  isPrimary: true,
                  reviewStatus: "approved",
                },
              ],
            }),
          };
        }
        if (url.includes("/api/recruiter/openings")) {
          return {
            ok: true,
            json: async () => ({
              openings: [
                {
                  id: "op-1",
                  role: "Bartender",
                  area: "Sukhumvit",
                  isPublished: true,
                  venueId: "venue-1",
                },
              ],
            }),
          };
        }
        return { ok: false, json: async () => ({}) };
      })
    );
  });

  it("shows char counter and opening upsell when attach is disabled", async () => {
    render(
      <SendContactRequestDialog
        open
        workerProfileId="11111111-1111-1111-1111-111111111111"
        onClose={() => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("opener-char-counter")).toHaveTextContent(
        "dialog.characters"
      );
    });
    expect(screen.getByTestId("opening-upsell")).toBeInTheDocument();
    expect(screen.getByLabelText("dialog.opening")).toBeDisabled();
  });
});
