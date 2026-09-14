import { describe, it, expect, vi } from "vitest";
import { PROFILE_PHOTO_ERRORS } from "../profile-photo";
import {
  callProfilePhotoFetch,
  uploadProfilePhoto,
} from "../upload-profile-photo";

function jpegFile(size = 1024, name = "photo.jpg", type = "image/jpeg"): File {
  return new File([new Uint8Array(size)], name, { type });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function okResponse(): Response {
  return new Response(null, { status: 200 });
}

const STAGING_KEY = "profile-photo-staging/u1/photo.jpeg";
const PUBLIC_KEY = "profiles/u1/photo.jpeg";
const PUBLIC_URL = "https://cdn.example/profiles/u1/photo.jpeg";

const identityPrepare = async (file: File): Promise<File> => file;

function approvedConfirmBody(): Record<string, unknown> {
  return {
    success: true,
    photoKey: PUBLIC_KEY,
    url: PUBLIC_URL,
    moderation: { status: "approved", message: "Photo approved" },
  };
}

describe("uploadProfilePhoto", () => {
  it("gives an explicit size error before any network call", async () => {
    const fetchMock = vi.fn();
    const file = jpegFile(10 * 1024 * 1024 + 12);

    await expect(
      uploadProfilePhoto(file, {
        fetch: fetchMock as unknown as typeof fetch,
        prepareImage: identityPrepare,
      })
    ).rejects.toThrow(PROFILE_PHOTO_ERRORS.tooLarge);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives a clear HEIC error if the browser did not convert the file", async () => {
    const fetchMock = vi.fn();
    const file = new File([new Uint8Array(2048)], "IMG_1.HEIC", {
      type: "image/heic",
    });

    await expect(
      uploadProfilePhoto(file, {
        fetch: fetchMock as unknown as typeof fetch,
        prepareImage: identityPrepare,
      })
    ).rejects.toThrow(PROFILE_PHOTO_ERRORS.heic);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads an allowed JPEG to private staging then returns the approved public URL", async () => {
    const file = jpegFile();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/media/upload" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          contentType: string;
          contentLength: number;
        };
        expect(body.contentType).toBe("image/jpeg");
        expect(body.contentLength).toBe(file.size);
        return jsonResponse({
          uploadUrl: "https://storage.example/upload",
          key: STAGING_KEY,
        });
      }
      if (url === "https://storage.example/upload" && init?.method === "PUT") {
        return okResponse();
      }
      if (url === "/api/media/upload" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as {
          key: string;
          publicUrl?: string;
        };
        expect(body.key).toBe(STAGING_KEY);
        expect(body.publicUrl).toBeUndefined();
        return jsonResponse(approvedConfirmBody());
      }
      throw new Error(`Unexpected fetch ${init?.method} ${url}`);
    });

    await expect(
      uploadProfilePhoto(file, {
        fetch: fetchMock as unknown as typeof fetch,
        prepareImage: identityPrepare,
      })
    ).resolves.toEqual({
      status: "approved",
      photoKey: PUBLIC_KEY,
      publicUrl: PUBLIC_URL,
      message: "Photo approved",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not treat a pending confirm as a public URL", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/media/upload" && init?.method === "POST") {
        return jsonResponse({
          uploadUrl: "https://storage.example/upload",
          key: STAGING_KEY,
        });
      }
      if (url === "https://storage.example/upload") {
        return okResponse();
      }
      return jsonResponse({
        success: true,
        photoKey: null,
        url: null,
        moderation: {
          status: "pending",
          message: "Photo under review",
        },
      });
    });

    await expect(
      uploadProfilePhoto(jpegFile(), {
        fetch: fetchMock as unknown as typeof fetch,
        prepareImage: identityPrepare,
      })
    ).resolves.toEqual({
      status: "pending",
      photoKey: null,
      publicUrl: null,
      message: "Photo under review",
    });
  });

  it("reports preparing, uploading, and saving stages", async () => {
    const file = jpegFile();
    const stages: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/media/upload" && init?.method === "POST") {
        return jsonResponse({
          uploadUrl: "https://storage.example/upload",
          key: STAGING_KEY,
        });
      }
      if (url === "https://storage.example/upload" && init?.method === "PUT") {
        return okResponse();
      }
      if (url === "/api/media/upload" && init?.method === "PUT") {
        return jsonResponse(approvedConfirmBody());
      }
      throw new Error(`Unexpected fetch ${init?.method} ${url}`);
    });

    await uploadProfilePhoto(file, {
      fetch: fetchMock as unknown as typeof fetch,
      prepareImage: identityPrepare,
      onStage: (stage) => stages.push(stage),
    });

    expect(stages).toEqual(["preparing", "uploading", "saving"]);
  });

  it("surfaces a useful message when presign fails", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { error: "Age verification required", message: "Age verification required" },
        403
      )
    );

    await expect(
      uploadProfilePhoto(jpegFile(), {
        fetch: fetchMock as unknown as typeof fetch,
        prepareImage: identityPrepare,
      })
    ).rejects.toThrow("Age verification required");
  });

  it("surfaces a useful upload error when storage PUT fails with Load failed", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/media/upload" && init?.method === "POST") {
        return jsonResponse({
          uploadUrl: "https://storage.example/upload",
          key: STAGING_KEY,
        });
      }
      if (url === "https://storage.example/upload") {
        throw new TypeError("Load failed");
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    await expect(
      uploadProfilePhoto(jpegFile(), {
        fetch: fetchMock as unknown as typeof fetch,
        prepareImage: identityPrepare,
      })
    ).rejects.toThrow(PROFILE_PHOTO_ERRORS.uploadFailed);
  });

  it("surfaces the backend message when confirm fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/media/upload" && init?.method === "POST") {
        return jsonResponse({
          uploadUrl: "https://storage.example/upload",
          key: STAGING_KEY,
        });
      }
      if (url === "https://storage.example/upload") {
        return okResponse();
      }
      return jsonResponse(
        {
          error: "Upload limit reached",
          message: "You already have a photo under review.",
        },
        400
      );
    });

    await expect(
      uploadProfilePhoto(jpegFile(), {
        fetch: fetchMock as unknown as typeof fetch,
        prepareImage: identityPrepare,
      })
    ).rejects.toThrow("You already have a photo under review.");
  });

  it("REGRESSION: Safari unbound Window.fetch is invoked with a Window this", async () => {
    const file = jpegFile();

    function safariFetch(
      this: unknown,
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      if (this !== globalThis) {
        throw new TypeError(
          "Can only call Window.fetch on instances of Window."
        );
      }

      const url = String(input);
      if (url === "/api/media/upload" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            uploadUrl: "https://storage.example/upload",
            key: STAGING_KEY,
          })
        );
      }
      if (url === "https://storage.example/upload") {
        return Promise.resolve(okResponse());
      }
      if (url === "/api/media/upload" && init?.method === "PUT") {
        return Promise.resolve(jsonResponse(approvedConfirmBody()));
      }
      throw new Error(`Unexpected fetch ${init?.method} ${url}`);
    }

    const unbound = safariFetch as typeof fetch;
    expect(() => {
      void unbound("/api/media/upload", { method: "POST" });
    }).toThrow("Can only call Window.fetch on instances of Window.");

    await expect(
      callProfilePhotoFetch(unbound, "/api/media/upload", { method: "POST" })
    ).resolves.toBeInstanceOf(Response);

    await expect(
      uploadProfilePhoto(file, {
        fetch: unbound,
        prepareImage: identityPrepare,
      })
    ).resolves.toEqual({
      status: "approved",
      photoKey: PUBLIC_KEY,
      publicUrl: PUBLIC_URL,
      message: "Photo approved",
    });
  });
});
