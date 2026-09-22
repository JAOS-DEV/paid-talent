import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.fn();
const setUserLocale = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock("@/lib/i18n/actions", () => ({
  setUserLocale: (...args: unknown[]) => setUserLocale(...args),
}));

import { LanguageToggle } from "../LanguageToggle";

describe("LanguageToggle", () => {
  beforeEach(() => {
    refresh.mockReset();
    setUserLocale.mockReset();
    setUserLocale.mockResolvedValue(undefined);
  });

  it("shows an EN | Thai control and persists Thai", async () => {
    render(<LanguageToggle />);

    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "ไทย" }));

    expect(setUserLocale).toHaveBeenCalledWith("th");
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "ไทย" })).not.toBeDisabled();
    });
  });
});
