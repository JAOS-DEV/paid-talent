import type { Page, Request, Response } from "@playwright/test";

export type UploadStageCategory = "presign" | "storage" | "confirm";

export interface SafeUploadStageEvent {
  category: UploadStageCategory;
  method: string;
  status?: number;
  failed?: string;
  message?: string;
  error?: string;
}

function classify(url: string, method: string): UploadStageCategory | null {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://localhost");
  } catch {
    return null;
  }

  const path = parsed.pathname;
  const host = parsed.hostname;

  if (path === "/api/media/upload" || path.endsWith("/api/media/upload")) {
    if (method === "POST") return "presign";
    if (method === "PUT") return "confirm";
    return null;
  }

  if (
    (method === "PUT" || method === "OPTIONS") &&
    (host.endsWith("r2.cloudflarestorage.com") ||
      host.endsWith("amazonaws.com") ||
      path.includes("profile-photo-staging"))
  ) {
    return "storage";
  }

  return null;
}

function safeBodyFields(payload: unknown): { message?: string; error?: string } {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const record = payload as Record<string, unknown>;
  return {
    message:
      typeof record.message === "string"
        ? record.message.slice(0, 200)
        : undefined,
    error:
      typeof record.error === "string" ? record.error.slice(0, 200) : undefined,
  };
}

export function attachUploadStageCapture(page: Page): {
  events: SafeUploadStageEvent[];
  origin: () => string;
} {
  const events: SafeUploadStageEvent[] = [];

  page.on("requestfailed", (request: Request) => {
    const category = classify(request.url(), request.method());
    if (!category) return;
    events.push({
      category,
      method: request.method(),
      failed: request.failure()?.errorText,
    });
  });

  page.on("response", (response: Response) => {
    const category = classify(response.url(), response.request().method());
    if (!category) return;
    const event: SafeUploadStageEvent = {
      category,
      method: response.request().method(),
      status: response.status(),
    };
    events.push(event);
    if (category === "presign" || category === "confirm") {
      void response
        .json()
        .then((payload) => {
          const fields = safeBodyFields(payload);
          event.message = fields.message;
          event.error = fields.error;
        })
        .catch(() => undefined);
    }
  });

  return {
    events,
    origin: () => {
      try {
        return new URL(page.url()).origin;
      } catch {
        return "unknown";
      }
    },
  };
}
