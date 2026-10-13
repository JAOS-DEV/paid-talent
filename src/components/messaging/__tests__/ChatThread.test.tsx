import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import { ChatThread } from "../ChatThread";

function wrap(ui: React.ReactElement): React.ReactElement {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("ChatThread", () => {
  it("renders contact_share card", () => {
    render(
      wrap(
        <ChatThread
          showSafetyBanner={false}
          messages={[
            {
              id: "1",
              kind: "contact_share",
              body: "LINE: neonbar99",
              isMine: false,
              createdAt: new Date().toISOString(),
            },
          ]}
        />
      )
    );
    expect(screen.getByTestId("contact-share-card")).toBeInTheDocument();
  });

  it("does not render anchor tags from message text", () => {
    const { container } = render(
      wrap(
        <ChatThread
          showSafetyBanner={false}
          messages={[
            {
              id: "2",
              kind: "text",
              body: "visit https://evil.com now",
              isMine: false,
              createdAt: new Date().toISOString(),
            },
          ]}
        />
      )
    );
    expect(container.querySelector("a")).toBeNull();
  });
});
