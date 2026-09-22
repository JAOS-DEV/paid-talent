import { describe, expect, it, vi } from "vitest";
import { PROFILE_PHOTO_ERRORS } from "@/lib/media/profile-photo";
import { uploadVenueLogo } from "@/lib/media/upload-venue-logo";

function jpegFile(size = 1024): File {
  return new File([new Uint8Array(size)], "logo.jpg", { type: "image/jpeg" });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const identityPrepare = async (file: File): Promise<File> => file;

describe("uploadVenueLogo", () => {
  it("rejects an oversized file before any network call", async () => {
    const fetchMock = vi.fn();
    await expect(
      uploadVenueLogo(jpegFile(10 * 1024 * 1024 + 8), {
        fetch: fetchMock as unknown as typeof fetch,
        prepareImage: identityPrepare,
      })
    ).rejects.toThrow(PROFILE_PHOTO_ERRORS.tooLarge);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("presigns, uploads, and confirms a public logo url", async () => {
    const stages: string[] = [];
    const file = jpegFile();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/recruiter/logo" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          contentType: string;
          folder: string;
          contentLength: number;
        };
        expect(body).toMatchObject({
          contentType: "image/jpeg",
          folder: "profiles",
          contentLength: file.size,
        });
        return jsonResponse({
          uploadUrl: "https://upload.example/put",
          key: "profile-photo-staging/u1/logo.jpeg",
        });
      }
      if (url === "https://upload.example/put" && init?.method === "PUT") {
        return new Response(null, { status: 200 });
      }
      if (url === "/api/recruiter/logo" && init?.method === "PUT") {
        expect(JSON.parse(String(init.body))).toEqual({
          key: "profile-photo-staging/u1/logo.jpeg",
        });
        return jsonResponse({
          success: true,
          logoKey: "profiles/u1/logo.jpeg",
          logoUrl: "https://cdn.example/profiles/u1/logo.jpeg",
        });
      }
      throw new Error(`unexpected ${init?.method} ${url}`);
    });

    const result = await uploadVenueLogo(file, {
      fetch: fetchMock as unknown as typeof fetch,
      prepareImage: identityPrepare,
      onStage: (stage) => stages.push(stage),
    });

    expect(result).toEqual({
      logoKey: "profiles/u1/logo.jpeg",
      logoUrl: "https://cdn.example/profiles/u1/logo.jpeg",
    });
    expect(stages).toEqual(["preparing", "uploading", "saving"]);
  });

  it("does not accept a signed confirm url", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/recruiter/logo" && init?.method === "POST") {
        return jsonResponse({
          uploadUrl: "https://upload.example/put",
          key: "profile-photo-staging/u1/logo.jpeg",
        });
      }
      if (init?.method === "PUT" && url.startsWith("https://upload.example")) {
        return new Response(null, { status: 200 });
      }
      return jsonResponse({
        success: true,
        logoKey: "profiles/u1/logo.jpeg",
        logoUrl: "https://cdn.example/logo.jpeg?X-Amz-Signature=secret",
      });
    });

    await expect(
      uploadVenueLogo(jpegFile(), {
        fetch: fetchMock as unknown as typeof fetch,
        prepareImage: identityPrepare,
      })
    ).rejects.toThrow("We couldn't upload your logo");
  });
});
