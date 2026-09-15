import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecruiterBackLink } from "../RecruiterBackLink";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }): React.ReactElement => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("RecruiterBackLink", () => {
  it("uses a deterministic href and a comfortable tap target", () => {
    render(
      <RecruiterBackLink href="/recruiter/dashboard">
        ← Back to Dashboard
      </RecruiterBackLink>
    );

    const link = screen.getByRole("link", { name: /back to dashboard/i });
    expect(link).toHaveAttribute("href", "/recruiter/dashboard");
    expect(link.className).toContain("min-h-11");
  });
});
