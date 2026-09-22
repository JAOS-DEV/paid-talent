import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpeningInterestSelect } from "../OpeningInterestSelect";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }): React.ReactElement => <a href={href}>{children}</a>,
}));

describe("OpeningInterestSelect", () => {
  it("shows formatted pay on published opening choices", () => {
    render(
      <OpeningInterestSelect
        value=""
        onChange={() => undefined}
        openings={[
          {
            id: "1",
            role: "Bartender",
            area: "Sukhumvit",
            isPublished: true,
            payMin: 1200,
            payMax: null,
            payCurrency: "THB",
            payPeriod: "night",
          },
          {
            id: "2",
            role: "Server",
            area: "Pattaya",
            isPublished: false,
            payMin: 800,
            payMax: null,
            payCurrency: "THB",
            payPeriod: "night",
          },
        ]}
      />
    );

    expect(
      screen.getByRole("option", {
        name: "Bartender — Sukhumvit · ฿1,200 / night",
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Server/ })
    ).not.toBeInTheDocument();
  });
});
