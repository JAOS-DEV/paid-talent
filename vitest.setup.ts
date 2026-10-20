import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

vi.mock("next-intl", async () => {
  const { createTranslator } = await import("./src/test/intl-translator");
  return {
    useTranslations: (namespace?: string) => createTranslator(namespace),
    useLocale: () => "en",
    NextIntlClientProvider: ({
      children,
    }: {
      children: React.ReactNode;
    }): React.ReactNode => children,
  };
});

vi.mock("next-intl/server", async () => {
  const { createTranslator, enMessages } = await import("./src/test/intl-translator");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
    getLocale: async () => "en",
    getMessages: async () => enMessages,
    getRequestConfig: (fn: unknown) => fn,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  users: {},
  workerProfiles: {},
  contactRequests: {},
  recruiterProfiles: {},
  recruiterOpenings: {},
  venues: {},
  profilePhotos: {},
  profileViews: {},
  hireOutcomes: {},
  hireOutcomeConfirmationRequests: {},
  subscriptions: {},
  billingPriceSettings: {},
  topTalentPasses: {},
  verificationEvents: {},
  adminAuditEvents: {},
  platformSettings: {},
}));

vi.mock("next/server", () => {
  class MockNextRequest extends Request {
    get nextUrl(): URL {
      return new URL(this.url);
    }

    get cookies(): {
      get: (name: string) => { name: string; value: string } | undefined;
    } {
      const header = this.headers.get("cookie") ?? "";
      return {
        get(name: string) {
          const match = header
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${name}=`));
          if (!match) return undefined;
          return { name, value: decodeURIComponent(match.slice(name.length + 1)) };
        },
      };
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      json: (data: unknown, init?: { status?: number }) => ({
        json: async () => data,
        status: init?.status ?? 200,
        headers: new Headers(),
        cookies: { set: () => undefined },
      }),
      redirect: (url: string | URL, status = 307) => {
        const location = typeof url === "string" ? url : url.toString();
        const headers = new Headers({ location });
        return {
          status,
          headers,
          cookies: {
            set: (
              name: string,
              value: string,
              options?: Record<string, unknown>
            ) => {
              void name;
              void value;
              void options;
            },
          },
          json: async () => ({}),
        };
      },
    },
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
