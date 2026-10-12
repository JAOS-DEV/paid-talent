import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { IdentityVerificationFlow } from "../IdentityVerificationFlow";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("@/components/layout", () => ({
  Header: (): React.ReactElement => <header>Header</header>,
  Footer: (): React.ReactElement => <footer>Footer</footer>,
}));

vi.mock("@/components/verification/LiveLivenessRecorder", () => ({
  LiveLivenessRecorder: (): React.ReactElement => (
    <div data-testid="liveness-recorder" />
  ),
}));

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe("IdentityVerificationFlow", () => {
  beforeEach(() => {
    push.mockReset();
    vi.unstubAllGlobals();
  });

  it("renders with the recruiter verification namespace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          verification: { verificationStatus: "unverified" },
        })
      )
    );

    render(
      <IdentityVerificationFlow
        apiBasePath="/api/recruiter/verification"
        translationNamespace="recruiter.verification"
        onVerifiedHref="/recruiter/dashboard"
      />
    );

    expect(
      await screen.findByRole("heading", { name: /verify your identity/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/never shown to talent/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/recruiter/verification"
      );
    });
  });
});
