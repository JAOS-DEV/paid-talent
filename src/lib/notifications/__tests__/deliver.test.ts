import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessagingSettings = vi.fn();
const canDeliverTo = vi.fn();
const send = vi.fn();
const isConfigured = vi.fn(() => true);
const afterMock = vi.fn();

const selectResults: unknown[][] = [];
const updateSets: Array<Record<string, unknown>> = [];
/** Claim returning() queue — first update in deliver() is the atomic claim. */
const claimResults: unknown[][] = [];
let rowState: Record<string, unknown> | null = null;

vi.mock("next/server", () => ({
  after: (...args: unknown[]) => afterMock(...args),
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}));

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
            where: vi.fn(() => ({
              returning: vi.fn(async () => {
                // Claim updates set only lastError: null.
                const isClaim =
                  Object.keys(patch).length === 1 &&
                  Object.prototype.hasOwnProperty.call(patch, "lastError");
                if (isClaim) {
                  const claimed = claimResults.shift() ?? [];
                  if (claimed[0] && typeof claimed[0] === "object") {
                    rowState = { ...(claimed[0] as Record<string, unknown>) };
                  }
                  return claimed;
                }
                if (rowState) {
                  rowState = { ...rowState, ...patch };
                }
                return [];
              }),
              then(
                resolve: (value: unknown) => void,
                reject?: (reason: unknown) => void
              ): void {
                if (rowState) {
                  rowState = { ...rowState, ...patch };
                }
                void Promise.resolve(undefined).then(resolve, reject);
              },
            })),
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

import { deliver, retryPending, scheduleDeliver } from "../notify";

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
    claimResults.length = 0;
    rowState = null;
    isConfigured.mockReturnValue(true);
    canDeliverTo.mockResolvedValue({ ok: true });
    send.mockResolvedValue({ ok: true });
    getMessagingSettings.mockResolvedValue({ notifyCooldownMinutes: 30 });
  });

  it("skips email when disabled (in-app only)", async () => {
    claimResults.push([baseRow()]);
    selectResults.push(
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
    claimResults.push([
      baseRow({
        type: "new_message",
        dedupeKey: "new_message:c1:u1",
        payload: { conversationId: "c1", senderName: "Ann" },
      }),
    ]);
    selectResults.push(
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: true, locale: "en" }],
      [{ id: "older" }]
    );

    await deliver("n1");

    expect(send).not.toHaveBeenCalled();
    expect(
      updateSets.some(
        (p) =>
          p.emailStatus === "skipped" &&
          p.lineStatus === "skipped" &&
          p.lastError === "throttled"
      )
    ).toBe(true);
  });

  it("increments attempts on failure", async () => {
    claimResults.push([baseRow({ attempts: 1 })]);
    selectResults.push(
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

    // Each deliver claims; empty claim → no-op
    claimResults.push([], []);

    const count = await retryPending(now);
    expect(count).toBe(2);
  });

  it("calling deliver twice on the same id sends the email once", async () => {
    claimResults.push([baseRow()]);
    // Second claim finds nothing (row no longer pending/failed after first send)
    claimResults.push([]);
    selectResults.push(
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: true, locale: "en" }]
    );

    await deliver("n1");
    await deliver("n1");

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("scheduleDeliver passes after() a function that returns a Promise", async () => {
    claimResults.push([]);

    scheduleDeliver("n-schedule");

    expect(afterMock).toHaveBeenCalledTimes(1);
    const fn = afterMock.mock.calls[0]?.[0] as () => unknown;
    expect(typeof fn).toBe("function");
    const result = fn();
    expect(result).toEqual(expect.any(Promise));
    await result;
  });
});
