import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

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
