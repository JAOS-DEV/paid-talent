import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import { MessageComposer } from "../MessageComposer";

function wrap(ui: React.ReactElement): React.ReactElement {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("MessageComposer", () => {
  it("shows blocked nudge when send returns contact_info_blocked", async () => {
    const onSend = vi.fn().mockResolvedValue({ code: "contact_info_blocked" });
    render(wrap(<MessageComposer maxChars={200} onSend={onSend} />));

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "0812345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByTestId("blocked-nudge")).toBeInTheDocument();
    });
  });
});
