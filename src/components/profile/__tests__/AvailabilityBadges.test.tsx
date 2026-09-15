import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvailabilityBadges } from "../AvailabilityBadges";

describe("AvailabilityBadges", () => {
  it("renders multiple values as badges instead of a raw joined string", () => {
    const { container } = render(
      <AvailabilityBadges values={["Full-time", "Part-time", "On-call"]} />
    );

    expect(screen.getByText("Full-time")).toBeInTheDocument();
    expect(screen.getByText("Part-time")).toBeInTheDocument();
    expect(screen.getByText("On-call")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Full-time,Part-time,On-call");
  });
});
