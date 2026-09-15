import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AvailabilityPicker } from "../AvailabilityPicker";

describe("AvailabilityPicker", () => {
  it("allows multiple independent selections", () => {
    const selected: string[][] = [];
    function Harness(): React.ReactElement {
      const [value, setValue] = React.useState<string[]>(["Full-time"]);
      return (
        <AvailabilityPicker
          value={value}
          onChange={(next) => {
            selected.push(next);
            setValue(next);
          }}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Part-time" }));
    fireEvent.click(screen.getByRole("button", { name: "On-call" }));

    expect(selected.at(-1)).toEqual(["Full-time", "Part-time", "On-call"]);
  });
});
