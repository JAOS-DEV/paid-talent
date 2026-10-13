import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReportDialog } from "../ReportDialog";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("ReportDialog", () => {
  it("requires a reason before submit", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ReportDialog
        open
        onClose={() => undefined}
        conversationId="11111111-1111-4111-8111-111111111111"
      />
    );

    fireEvent.click(screen.getByTestId("report-submit"));
    expect(screen.getByTestId("report-error")).toHaveTextContent(
      "reasonRequired"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits when a reason is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ReportDialog
        open
        onClose={() => undefined}
        conversationId="11111111-1111-4111-8111-111111111111"
      />
    );

    fireEvent.click(screen.getByTestId("report-reason-spam"));
    fireEvent.click(screen.getByTestId("report-submit"));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
