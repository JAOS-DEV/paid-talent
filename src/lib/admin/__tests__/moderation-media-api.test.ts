import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminApi = vi.fn();
const getPendingWorkerMediaForAdmin = vi.fn();
const getPendingPhotoMediaForAdmin = vi.fn();

vi.mock("@/lib/admin/api-guard", () => ({
  requireAdminApi: (...args: unknown[]) => requireAdminApi(...args),
}));

vi.mock("@/lib/admin/pending-data", () => ({
  getPendingWorkerMediaForAdmin: (...args: unknown[]) =>
    getPendingWorkerMediaForAdmin(...args),
  getPendingPhotoMediaForAdmin: (...args: unknown[]) =>
    getPendingPhotoMediaForAdmin(...args),
}));

import { GET as getWorkerMedia } from "@/app/api/admin/workers/[id]/media/route";
import { GET as getPhotoMedia } from "@/app/api/admin/photos/[id]/media/route";

describe("lazy admin moderation media APIs", () => {
  beforeEach(() => {
    requireAdminApi.mockReset();
    getPendingWorkerMediaForAdmin.mockReset();
    getPendingPhotoMediaForAdmin.mockReset();
  });

  it("rejects non-admin worker media requests", async () => {
    requireAdminApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      }),
    });

    const response = await getWorkerMedia(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "worker-1" }),
    });

    expect(response.status).toBe(403);
    expect(getPendingWorkerMediaForAdmin).not.toHaveBeenCalled();
  });

  it("rejects non-admin photo media requests", async () => {
    requireAdminApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      }),
    });

    const response = await getPhotoMedia(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "photo-1" }),
    });

    expect(response.status).toBe(403);
    expect(getPendingPhotoMediaForAdmin).not.toHaveBeenCalled();
  });

  it("returns short-lived signed URLs for an allowlisted admin", async () => {
    requireAdminApi.mockResolvedValue({
      ok: true,
      actor: { userId: "admin-1", email: "admin@example.com" },
    });
    getPendingWorkerMediaForAdmin.mockResolvedValue({
      idDocumentUrl: "https://signed.example/id",
      livenessVideoUrl: "https://signed.example/video",
      expiresIn: 300,
    });

    const response = await getWorkerMedia(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "worker-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      idDocumentUrl: "https://signed.example/id",
      livenessVideoUrl: "https://signed.example/video",
      expiresIn: 300,
    });
    expect(getPendingWorkerMediaForAdmin).toHaveBeenCalledWith({
      workerProfileId: "worker-1",
      adminEmail: "admin@example.com",
    });
  });
});
