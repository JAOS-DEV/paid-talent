import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RolesStep } from "../RolesStep";

vi.mock("@/app/worker/actions", () => ({
  updateProfileRoles: vi.fn(),
}));

import { updateProfileRoles } from "@/app/worker/actions";

const mockedUpdate = vi.mocked(updateProfileRoles);

describe("RolesStep", () => {
  it("shows Dancer and PR / Promotions and opens a custom Other input", async () => {
    mockedUpdate.mockResolvedValue({ success: true });

    render(
      <RolesStep
        initialRoles={[]}
        onComplete={() => undefined}
        onBack={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: "Dancer" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "PR / Promotions" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(screen.getByLabelText("Other role")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dancer" }));
    fireEvent.change(screen.getByLabelText("Other role"), {
      target: { value: "Model" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await vi.waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith({
        jobRoles: ["Dancer", "Model"],
        customJobRole: "Model",
      });
    });
  });

  it("reloads a stored custom role into the Other input", () => {
    render(
      <RolesStep
        initialRoles={["Bartender", "Mixologist"]}
        onComplete={() => undefined}
        onBack={() => undefined}
      />
    );

    expect(screen.getByLabelText("Other role")).toHaveValue("Mixologist");
  });
});
