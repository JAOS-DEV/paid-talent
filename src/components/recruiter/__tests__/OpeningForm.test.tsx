import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OpeningForm } from "../OpeningForm";
import { LEGACY_PAY_RANGE_MESSAGE } from "@/lib/recruiter-profile/opening-pay";
import type { RecruiterOpening } from "@/lib/db/schema";

const push = vi.fn();
const refresh = vi.fn();
const createOpening = vi.fn();
const updateOpening = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: (): { push: typeof push; refresh: typeof refresh } => ({
    push,
    refresh,
  }),
}));

vi.mock("@/lib/recruiter-profile/actions", () => ({
  createOpening: (...args: unknown[]) => createOpening(...args),
  updateOpening: (...args: unknown[]) => updateOpening(...args),
}));

function mockOpening(
  overrides: Partial<RecruiterOpening> = {}
): RecruiterOpening {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    recruiterProfileId: "profile-1",
    role: "Bartender",
    area: "Sukhumvit",
    payMin: 1200,
    payMax: null,
    payCurrency: "USD",
    payPeriod: "week",
    notes: null,
    isPublished: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("OpeningForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    createOpening.mockReset();
    updateOpening.mockReset();
    createOpening.mockResolvedValue({ success: true, data: mockOpening() });
    updateOpening.mockResolvedValue({ success: true });
  });

  it("replaces min/max with a single pay field and defaults currency to THB", () => {
    render(<OpeningForm mode="create" />);

    expect(screen.getByLabelText(/pay amount/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/minimum pay/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/maximum pay/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^currency$/i)).toHaveValue("THB");
    expect(screen.getByRole("button", { name: /per night/i })).toHaveClass(
      "bg-primary-600"
    );
  });

  it("loads an existing non-THB currency instead of resetting to THB", () => {
    render(
      <OpeningForm mode="edit" initialOpening={mockOpening({ payCurrency: "EUR" })} />
    );

    expect(screen.getByLabelText(/^currency$/i)).toHaveValue("EUR");
    expect(screen.getByLabelText(/pay amount/i)).toHaveValue(1200);
    expect(screen.getByRole("button", { name: /per week/i })).toHaveClass(
      "bg-primary-600"
    );
  });

  it("saves one advertised pay amount for a new opening", async () => {
    render(<OpeningForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/^role \*/i), {
      target: { value: "Hostess" },
    });
    fireEvent.change(screen.getByLabelText(/^area \*/i), {
      target: { value: "Thonglor" },
    });
    fireEvent.change(screen.getByLabelText(/pay amount/i), {
      target: { value: "1200" },
    });
    fireEvent.change(screen.getByLabelText(/^currency$/i), {
      target: { value: "USD" },
    });
    fireEvent.click(screen.getByRole("button", { name: /per week/i }));
    fireEvent.click(screen.getByRole("button", { name: /save as draft/i }));

    await vi.waitFor(() => {
      expect(createOpening).toHaveBeenCalledWith({
        role: "Hostess",
        area: "Thonglor",
        payAmount: 1200,
        payCurrency: "USD",
        payPeriod: "week",
        notes: undefined,
        isPublished: false,
      });
    });
  });

  it("shows structured custom period controls", async () => {
    render(<OpeningForm mode="create" />);

    fireEvent.click(screen.getByRole("button", { name: /^custom$/i }));
    fireEvent.change(screen.getByLabelText(/^duration$/i), {
      target: { value: "15" },
    });
    fireEvent.change(screen.getByLabelText(/^unit$/i), {
      target: { value: "days" },
    });
    fireEvent.change(screen.getByLabelText(/^role \*/i), {
      target: { value: "DJ" },
    });
    fireEvent.change(screen.getByLabelText(/^area \*/i), {
      target: { value: "Sukhumvit" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save as draft/i }));

    await vi.waitFor(() => {
      expect(createOpening).toHaveBeenCalledWith(
        expect.objectContaining({
          payPeriod: "15 days",
        })
      );
    });
  });

  it("asks for a single amount before saving a legacy range", async () => {
    render(
      <OpeningForm
        mode="edit"
        initialOpening={mockOpening({ payMin: 500, payMax: 1000, payPeriod: "night" })}
      />
    );

    expect(screen.getByText(LEGACY_PAY_RANGE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText(/pay amount/i)).toHaveValue(null);

    const form = screen.getByRole("button", { name: /save changes/i }).closest(
      "form"
    );
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await vi.waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        LEGACY_PAY_RANGE_MESSAGE
      );
    });
    expect(updateOpening).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/pay amount/i), {
      target: { value: "750" },
    });
    fireEvent.submit(form!);

    await vi.waitFor(() => {
      expect(updateOpening).toHaveBeenCalledWith(
        expect.objectContaining({
          payAmount: 750,
          payPeriod: "night",
        })
      );
    });
  });

  it("uses pill chips for pay periods", () => {
    const { container } = render(<OpeningForm mode="create" />);
    expect(container.querySelector(".min-w-0")).not.toBeNull();
    expect(container.innerHTML).not.toContain("Minimum pay");
    expect(container.innerHTML).not.toContain("Maximum pay");
    expect(screen.getByRole("button", { name: /per night/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /per day/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /per week/i })).toBeInTheDocument();
  });
});
