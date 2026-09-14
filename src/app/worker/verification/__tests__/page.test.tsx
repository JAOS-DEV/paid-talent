import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const replace = vi.fn();
const push = vi.fn();
const useSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => useSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));

vi.mock("@/components/layout", () => ({
  Header: (): React.ReactElement => <header>Header</header>,
  Footer: (): React.ReactElement => <footer>Footer</footer>,
}));

vi.mock("@/components/verification/LiveLivenessRecorder", () => ({
  LiveLivenessRecorder: ({
    onRecorded,
    onCancel,
    onReacquireCamera,
  }: {
    onRecorded: (blob: Blob, contentType: "video/webm") => void;
    onCancel: () => void;
    onReacquireCamera: () => void;
  }): React.ReactElement => (
    <div data-testid="liveness-recorder">
      <button
        type="button"
        onClick={() =>
          onRecorded(
            new Blob(["live-bytes"], { type: "video/webm" }),
            "video/webm"
          )
        }
      >
        Use this video
      </button>
      <button type="button" onClick={onReacquireCamera}>
        Record again
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

import WorkerVerificationPage from "../page";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function workerSession(): void {
  useSession.mockReturnValue({
    status: "authenticated",
    data: {
      user: {
        id: "worker-1",
        role: "worker",
        email: "worker6@example.com",
      },
    },
  });
}

describe("Worker verification page", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    useSession.mockReset();
    vi.unstubAllGlobals();
  });

  it("redirects non-workers away from verification", async () => {
    useSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: { id: "recruiter-1", role: "recruiter" },
      },
    });

    render(<WorkerVerificationPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/auth/signin");
    });
  });

  it("shows an ID-first initial screen without challenge or video instructions", async () => {
    workerSession();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/worker/verification") {
        return jsonResponse({
          success: true,
          verification: { verificationStatus: "unverified" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkerVerificationPage />);

    expect(
      await screen.findByRole("heading", { name: /verify your identity/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Upload your ID")).toBeInTheDocument();
    expect(screen.getByText(/upload a clear photo/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Document type")).toBeInTheDocument();
    expect(screen.getByText("Upload ID photo")).toBeInTheDocument();
    expect(screen.queryByText("Start video")).not.toBeInTheDocument();
    expect(screen.queryByText("Start over")).not.toBeInTheDocument();
    expect(screen.queryByText("Say this code")).not.toBeInTheDocument();
    expect(screen.queryByText("Open camera")).not.toBeInTheDocument();
    expect(screen.queryByText(/hold your ID beside/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("challenge-code")).not.toBeInTheDocument();

    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs).toHaveLength(1);
    expect(fileInputs[0]).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp"
    );
    expect(
      document.querySelector('input[type="file"][accept*="video"]')
    ).toBeNull();

    const fetchedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(fetchedUrls).toEqual(["/api/worker/verification"]);
    expect(fetchedUrls.some((url) => url.includes("/challenge"))).toBe(false);
  });

  it("requires a successful ID upload before the live-video stage", async () => {
    workerSession();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/worker/verification") {
        return jsonResponse({
          success: true,
          verification: { verificationStatus: "unverified" },
        });
      }
      if (url === "/api/worker/verification/upload") {
        return jsonResponse({
          success: true,
          uploadUrl: "https://s3.test/id",
          key: "verification-docs/worker-1/id.jpg",
        });
      }
      if (url === "https://s3.test/id") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (url === "/api/worker/verification/challenge") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          idDocumentKey: "verification-docs/worker-1/id.jpg",
        });
        return jsonResponse({
          success: true,
          challenge: {
            code: "123456",
            displayCode: "123-456",
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkerVerificationPage />);
    await screen.findByText("Upload ID photo");

    const input = screen.getByTestId(
      "verification-id-file-input"
    ) as HTMLInputElement;
    const file = new File(["id-bytes"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("ID uploaded")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue to video verification/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Open camera")).not.toBeInTheDocument();
    expect(screen.queryByText("Start over")).not.toBeInTheDocument();
    expect(screen.getByText("Start again")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /continue to video verification/i })
    );

    expect(await screen.findByText("Step 2 of 2")).toBeInTheDocument();
    expect(
      screen.getByText("Record a short verification video")
    ).toBeInTheDocument();
    expect(screen.getByText("Say this code")).toBeInTheDocument();
    expect(screen.getByTestId("challenge-code")).toHaveTextContent("123-456");
    expect(
      screen.getByRole("button", { name: /open camera/i })
    ).toBeInTheDocument();
    expect(
      document.querySelector('input[type="file"][accept*="video"]')
    ).toBeNull();
    expect(screen.queryByText("Start video")).not.toBeInTheDocument();
  });

  it("handles ID upload failure without advancing to video", async () => {
    workerSession();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/worker/verification") {
        return jsonResponse({
          success: true,
          verification: { verificationStatus: "unverified" },
        });
      }
      if (url === "/api/worker/verification/upload") {
        return jsonResponse({ error: "ID upload failed" }, false, 400);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkerVerificationPage />);
    await screen.findByText("Upload ID photo");

    const input = screen.getByTestId(
      "verification-id-file-input"
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["id-bytes"], "id.jpg", { type: "image/jpeg" })],
      },
    });

    expect(await screen.findByText("ID upload failed")).toBeInTheDocument();
    expect(screen.queryByText("Step 2 of 2")).not.toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
  });

  it("handles camera permission denial without offering a saved video picker", async () => {
    workerSession();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/worker/verification") {
        return jsonResponse({
          success: true,
          verification: { verificationStatus: "unverified" },
        });
      }
      if (url === "/api/worker/verification/upload") {
        return jsonResponse({
          success: true,
          uploadUrl: "https://s3.test/id",
          key: "verification-docs/worker-1/id.jpg",
        });
      }
      if (url === "https://s3.test/id") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (url === "/api/worker/verification/challenge") {
        return jsonResponse({
          success: true,
          challenge: {
            code: "654321",
            displayCode: "654-321",
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("MediaRecorder", class FakeRecorder {});
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        }),
      },
    });

    render(<WorkerVerificationPage />);
    await screen.findByText("Upload ID photo");
    fireEvent.change(screen.getByTestId("verification-id-file-input"), {
      target: {
        files: [new File(["id-bytes"], "id.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: /continue to video verification/i,
      })
    );
    fireEvent.click(await screen.findByRole("button", { name: /open camera/i }));

    expect(
      await screen.findByText(/permission was denied/i)
    ).toBeInTheDocument();
    expect(
      document.querySelector('input[type="file"][accept*="video"]')
    ).toBeNull();
  });

  it("uploads a recorded blob through the private liveness flow", async () => {
    workerSession();
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/worker/verification") {
        return jsonResponse({
          success: true,
          verification: { verificationStatus: "unverified" },
        });
      }
      if (url === "/api/worker/verification/upload") {
        const body = JSON.parse(String(init?.body));
        if (body.type === "id_document") {
          return jsonResponse({
            success: true,
            uploadUrl: "https://s3.test/id",
            key: "verification-docs/worker-1/id.jpg",
          });
        }
        expect(body).toEqual({
          type: "liveness_video",
          contentType: "video/webm",
          idDocumentKey: "verification-docs/worker-1/id.jpg",
        });
        return jsonResponse({
          success: true,
          uploadUrl: "https://s3.test/video",
          key: "verification-liveness/worker-1/live.webm",
        });
      }
      if (url === "https://s3.test/id" || url === "https://s3.test/video") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (url === "/api/worker/verification/challenge") {
        return jsonResponse({
          success: true,
          challenge: {
            code: "123456",
            displayCode: "123-456",
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
        });
      }
      if (url === "/api/worker/verification" && init?.method === "POST") {
        return jsonResponse({ success: true });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("MediaRecorder", class FakeRecorder {});
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => fakeStream),
      },
    });

    render(<WorkerVerificationPage />);
    await screen.findByText("Upload ID photo");
    fireEvent.change(screen.getByTestId("verification-id-file-input"), {
      target: {
        files: [new File(["id-bytes"], "id.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: /continue to video verification/i,
      })
    );
    fireEvent.click(await screen.findByRole("button", { name: /open camera/i }));
    fireEvent.click(await screen.findByRole("button", { name: /use this video/i }));

    expect(
      await screen.findByRole("heading", { name: /ready to submit/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Verification video recorded")).toBeInTheDocument();

    const livenessUpload = fetchMock.mock.calls.find((call) => {
      if (String(call[0]) !== "/api/worker/verification/upload") return false;
      const body = JSON.parse(String(call[1]?.body));
      return body.type === "liveness_video";
    });
    expect(livenessUpload).toBeDefined();
    expect(JSON.parse(String(livenessUpload?.[1]?.body))).toEqual({
      type: "liveness_video",
      contentType: "video/webm",
      idDocumentKey: "verification-docs/worker-1/id.jpg",
    });
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]) === "https://s3.test/video")
    ).toBe(true);
  });

  it("requests a new MediaStream when the worker taps Record again", async () => {
    workerSession();
    const firstStream = { id: "stream-1", getTracks: () => [{ stop: vi.fn() }] };
    const secondStream = { id: "stream-2", getTracks: () => [{ stop: vi.fn() }] };
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(firstStream)
      .mockResolvedValueOnce(secondStream);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/worker/verification") {
        return jsonResponse({
          success: true,
          verification: { verificationStatus: "unverified" },
        });
      }
      if (url === "/api/worker/verification/upload") {
        return jsonResponse({
          success: true,
          uploadUrl: "https://s3.test/id",
          key: "verification-docs/worker-1/id.jpg",
        });
      }
      if (url === "https://s3.test/id") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (url === "/api/worker/verification/challenge") {
        return jsonResponse({
          success: true,
          challenge: {
            code: "123456",
            displayCode: "123-456",
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("MediaRecorder", class FakeRecorder {});
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia },
    });

    render(<WorkerVerificationPage />);
    await screen.findByText("Upload ID photo");
    fireEvent.change(screen.getByTestId("verification-id-file-input"), {
      target: {
        files: [new File(["id-bytes"], "id.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: /continue to video verification/i,
      })
    );
    fireEvent.click(await screen.findByRole("button", { name: /open camera/i }));
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    fireEvent.click(await screen.findByRole("button", { name: /record again/i }));
    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledTimes(2);
    });
    expect(getUserMedia.mock.calls[1]?.[0]).toEqual({
      video: { facingMode: "user" },
      audio: true,
    });
    expect(
      document.querySelector('input[type="file"][accept*="video"]')
    ).toBeNull();
  });

  it("handles an expired challenge on the video step", async () => {
    workerSession();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/worker/verification") {
        return jsonResponse({
          success: true,
          verification: { verificationStatus: "unverified" },
        });
      }
      if (url === "/api/worker/verification/upload") {
        return jsonResponse({
          success: true,
          uploadUrl: "https://s3.test/id",
          key: "verification-docs/worker-1/id.jpg",
        });
      }
      if (url === "https://s3.test/id") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (url === "/api/worker/verification/challenge") {
        return jsonResponse({
          success: true,
          challenge: {
            code: "123456",
            displayCode: "123-456",
            issuedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            isExpired: true,
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkerVerificationPage />);
    await screen.findByText("Upload ID photo");
    fireEvent.change(screen.getByTestId("verification-id-file-input"), {
      target: {
        files: [new File(["id-bytes"], "id.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: /continue to video verification/i,
      })
    );

    expect(
      await screen.findByText(/challenge code has expired/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /get a new code/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /open camera/i })
    ).not.toBeInTheDocument();
  });

  it("shows pending, verified, and rejected statuses from the existing API", async () => {
    workerSession();

    for (const [status, heading] of [
      ["pending", /verification pending/i],
      ["verified", /you're verified/i],
      ["rejected", /verification unsuccessful/i],
    ] as const) {
      const fetchMock = vi.fn(async () =>
        jsonResponse({
          success: true,
          verification: { verificationStatus: status },
        })
      );
      vi.stubGlobal("fetch", fetchMock);
      const view = render(<WorkerVerificationPage />);
      expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.queryByText("Step 1 of 2")).not.toBeInTheDocument();
      view.unmount();
    }
  });
});
