import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessagingSettings = vi.fn();
const canDeliverTo = vi.fn();
const send = vi.fn();
const isConfigured = vi.fn(() => true);

const rowsById = new Map<string, Record<string, unknown>>();
const selectResults: unknown[][] = [];
const updateSets: Array<Record<string, unknown>> = [];

vi.mock("@/lib/messaging/settings", () => ({
  getMessagingSettings: (...args: unknown[]) => getMessagingSettings(...args),
}));

vi.mock("@/lib/notifications/channels", () => ({
  getNotificationChannels: () => [
    {
      name: "email" as const,
      isConfigured: () => isConfigured(),
      canDeliverTo: (...args: unknown[]) => canDeliverTo(...args),
      send: (...args: unknown[]) => send(...args),
    },
  ],
}));

vi.mock("@/lib/db", () => {
  const notifications = {
    id: "id",
    userId: "user_id",
    type: "type",
    dedupeKey: "dedupe_key",
    readAt: "read_at",
    emailStatus: "email_status",
    lineStatus: "line_status",
    createdAt: "created_at",
    attempts: "attempts",
  };
  const users = { id: "id", role: "role", accountStatus: "account_status" };
  const userNotificationPrefs = {
    userId: "user_id",
    emailEnabled: "email_enabled",
    locale: "locale",
  };

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => selectResults.shift() ?? []),
            then(
              resolve: (value: unknown) => void,
              reject?: (reason: unknown) => void
            ): void {
              void Promise.resolve(selectResults.shift() ?? []).then(
                resolve,
                reject
              );
            },
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => selectResults.shift() ?? []),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((patch: Record<string, unknown>) => {
          updateSets.push(patch);
          return {
            where: vi.fn(async () => undefined),
          };
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => []),
        })),
      })),
    },
    notifications,
    users,
    userNotificationPrefs,
  };
});

import { deliver, retryPending } from "../notify";

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    userId: "u1",
    type: "contact_request_received",
    payload: { recruiterName: "Ann", venueName: "Venue" },
    dedupeKey: null,
    readAt: null,
    emailStatus: "pending",
    lineStatus: "pending",
    emailSentAt: null,
    lineSentAt: null,
    attempts: 0,
    lastError: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("deliver + retryPending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    updateSets.length = 0;
    rowsById.clear();
    isConfigured.mockReturnValue(true);
    canDeliverTo.mockResolvedValue({ ok: true });
    send.mockResolvedValue({ ok: true });
    getMessagingSettings.mockResolvedValue({ notifyCooldownMinutes: 30 });
  });

  it("skips email when disabled (in-app only)", async () => {
    selectResults.push(
      [baseRow()],
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: false, locale: "en" }]
    );
    canDeliverTo.mockResolvedValue({ ok: false, reason: "email_disabled" });

    await deliver("n1");

    expect(send).not.toHaveBeenCalled();
    expect(updateSets.some((p) => p.emailStatus === "skipped")).toBe(true);
    expect(updateSets.some((p) => p.lineStatus === "skipped")).toBe(true);
  });

  it("throttles new_message when recent unread was sent externally", async () => {
    selectResults.push(
      [
        baseRow({
          type: "new_message",
          dedupeKey: "new_message:c1:u1",
          payload: { conversationId: "c1", senderName: "Ann" },
        }),
      ],
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: true, locale: "en" }],
      [{ id: "older" }]
    );

    await deliver("n1");

    expect(send).not.toHaveBeenCalled();
    expect(updateSets[0]).toEqual(
      expect.objectContaining({
        emailStatus: "skipped",
        lineStatus: "skipped",
        lastError: "throttled",
      })
    );
  });

  it("increments attempts on failure", async () => {
    selectResults.push(
      [baseRow({ attempts: 1 })],
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: true, locale: "en" }]
    );
    send.mockResolvedValue({
      ok: false,
      error: "smtp_down",
      retryable: true,
    });

    await deliver("n1");

    expect(updateSets.some((p) => p.attempts === 2)).toBe(true);
    expect(updateSets.some((p) => p.emailStatus === "failed")).toBe(true);
  });

  it("retryPending only picks eligible rows", async () => {
    const now = new Date("2026-04-01T12:00:00Z");
    selectResults.push([{ id: "eligible-1" }, { id: "eligible-2" }]);

    // deliver will be called; feed empty so deliver no-ops quickly
    selectResults.push([], []);

    const count = await retryPending(now);
    expect(count).toBe(2);
  });
});
