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
  recruiterProfiles: {},
  recruiterOpenings: {},
  profilePhotos: {},
  profileViews: {},
  profileInterests: {},
  hireOutcomes: {},
  hireOutcomeConfirmationRequests: {},
  subscriptions: {},
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
