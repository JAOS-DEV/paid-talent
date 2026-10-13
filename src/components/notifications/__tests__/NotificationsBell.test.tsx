import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { NotificationsBell } from "../NotificationsBell";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: { count?: number }) => {
    if (ns === "navigation" && key === "notificationsUnread") {
      return `Notifications (${values?.count ?? 0})`;
    }
    if (ns === "navigation" && key === "notifications") return "Notifications";
    return key;
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
    className?: string;
  }): React.ReactElement => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

describe("NotificationsBell", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          unreadCount: 2,
          notifications: [
            {
              id: "n1",
              type: "new_message",
              subject: "New message",
              text: "You have a new message from Ann.",
              url: "http://localhost:3000/worker/messages/c1",
              readAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
        { status: 200 }
      )
    ) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows unread badge and opens dropdown", async () => {
    render(<NotificationsBell />);

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Notifications \(2\)/i }));

    await waitFor(() => {
      expect(screen.getByText("New message")).toBeInTheDocument();
    });
    expect(screen.getByText("viewSettings")).toBeInTheDocument();
  });
});
