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
import { AuthLocaleBar } from "../AuthLocaleBar";

describe("LanguageToggle", () => {
  beforeEach(() => {
    refresh.mockReset();
    setUserLocale.mockReset();
    setUserLocale.mockResolvedValue(undefined);
  });

  it("opens a globe menu with EN / ไทย and a check on the active locale", () => {
    render(<LanguageToggle />);

    const globe = screen.getByRole("button", { name: "Language" });
    expect(globe).toHaveAttribute("aria-haspopup", "menu");
    expect(globe).toHaveClass("h-8");
    expect(screen.queryByRole("group", { name: "Language" })).not.toBeInTheDocument();

    fireEvent.click(globe);

    expect(screen.getByRole("menuitemradio", { name: "EN" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("menuitemradio", { name: "ไทย" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByTestId("locale-active-check")).toBeInTheDocument();
  });

  it("persists Thai through setUserLocale", async () => {
    render(<LanguageToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "ไทย" }));

    expect(setUserLocale).toHaveBeenCalledWith("th");
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Language" })).not.toBeDisabled();
    });
    expect(screen.queryByRole("menu", { name: "Language" })).not.toBeInTheDocument();
  });

  it("uses the same globe menu on the auth locale bar", () => {
    render(<AuthLocaleBar />);

    expect(screen.getByRole("button", { name: "Language" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Language" })).not.toBeInTheDocument();
  });
});
