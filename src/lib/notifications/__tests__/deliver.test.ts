import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessagingSettings = vi.fn();
const canDeliverTo = vi.fn();
const send = vi.fn();
const isConfigured = vi.fn(() => true);
const lineCanDeliverTo = vi.fn();
const lineSend = vi.fn();
const lineIsConfigured = vi.fn(() => false);
const afterMock = vi.fn();
let includeLineChannel = false;

const selectResults: unknown[][] = [];
const updateSets: Array<Record<string, unknown>> = [];
const claimSets: Array<Record<string, unknown>> = [];
const claimWheres: unknown[] = [];
/** Claim returning() rows — first update in deliver() is the atomic claim. */
const claimResults: unknown[][] = [];
let rowState: Record<string, unknown> | null = null;
let selectShouldThrow = false;

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
  getNotificationChannels: () => {
    const channels: Array<{
      name: "email" | "line";
      isConfigured: () => boolean;
      canDeliverTo: (...args: unknown[]) => unknown;
      send: (...args: unknown[]) => unknown;
    }> = [];
    if (includeLineChannel) {
      channels.push({
        name: "line",
        isConfigured: () => lineIsConfigured(),
        canDeliverTo: (...args: unknown[]) => lineCanDeliverTo(...args),
        send: (...args: unknown[]) => lineSend(...args),
      });
    }
    channels.push({
      name: "email",
      isConfigured: () => isConfigured(),
      canDeliverTo: (...args: unknown[]) => canDeliverTo(...args),
      send: (...args: unknown[]) => send(...args),
    });
    return channels;
  },
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
    claimedAt: "claimed_at",
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
            limit: vi.fn(async () => {
              if (selectShouldThrow) {
                throw new Error("select boom");
              }
              return selectResults.shift() ?? [];
            }),
            then(
              resolve: (value: unknown) => void,
              reject?: (reason: unknown) => void
            ): void {
              if (selectShouldThrow) {
                void Promise.reject(new Error("select boom")).then(
                  resolve,
                  reject
                );
                return;
              }
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
            where: vi.fn((condition: unknown) => {
              const isClaim = Object.prototype.hasOwnProperty.call(
                patch,
                "claimedAt"
              ) && patch.claimedAt !== null;
              if (isClaim) {
                claimSets.push(patch);
                claimWheres.push(condition);
              }
              return {
                returning: vi.fn(async () => {
                  if (isClaim) {
                    const claimed = claimResults.shift() ?? [];
                    if (claimed[0] && typeof claimed[0] === "object") {
                      rowState = {
                        ...(claimed[0] as Record<string, unknown>),
                      };
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
              };
            }),
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

function containsClaimedAt(
  value: unknown,
  seen: WeakSet<object> = new WeakSet()
): boolean {
  if (value == null) return false;
  if (typeof value === "string") {
    return value.includes("claimed_at") || value.includes("claimedAt");
  }
  if (typeof value === "object") {
    if (seen.has(value)) return false;
    seen.add(value);
    const rec = value as Record<string, unknown>;
    if (rec.name === "claimed_at") return true;
    return Object.values(rec).some((child) => containsClaimedAt(child, seen));
  }
  return false;
}

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
    claimedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("deliver + retryPending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    updateSets.length = 0;
    claimSets.length = 0;
    claimWheres.length = 0;
    claimResults.length = 0;
    rowState = null;
    selectShouldThrow = false;
    includeLineChannel = false;
    isConfigured.mockReturnValue(true);
    canDeliverTo.mockResolvedValue({ ok: true });
    send.mockResolvedValue({ ok: true });
    lineIsConfigured.mockReturnValue(true);
    lineCanDeliverTo.mockResolvedValue({ ok: true });
    lineSend.mockResolvedValue({ ok: true });
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
          p.lastError === "throttled" &&
          p.claimedAt === null
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
    // Second claim finds nothing (lease held / statuses finalized)
    claimResults.push([]);
    selectResults.push(
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: true, locale: "en" }]
    );

    await deliver("n1");
    await deliver("n1");

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("claim SET includes claimedAt and WHERE includes claimed_at lease", async () => {
    claimResults.push([baseRow()]);
    selectResults.push(
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: true, locale: "en" }]
    );

    await deliver("n1");

    expect(claimSets.length).toBeGreaterThan(0);
    expect(claimSets[0]).toEqual(
      expect.objectContaining({
        claimedAt: expect.anything(),
        lastError: null,
      })
    );
    expect(claimWheres.some((where) => containsClaimedAt(where))).toBe(true);
  });

  it("clears claimedAt on success, failure, and catch paths", async () => {
    // Success
    claimResults.push([baseRow()]);
    selectResults.push(
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: true, locale: "en" }]
    );
    await deliver("n1");
    expect(
      updateSets.some(
        (p) => p.emailStatus === "sent" && p.claimedAt === null
      )
    ).toBe(true);

    updateSets.length = 0;
    claimSets.length = 0;

    // Failure (send fails)
    claimResults.push([baseRow({ id: "n2" })]);
    selectResults.push(
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: true, locale: "en" }]
    );
    send.mockResolvedValueOnce({
      ok: false,
      error: "smtp_down",
      retryable: true,
    });
    await deliver("n2");
    expect(
      updateSets.some(
        (p) => p.emailStatus === "failed" && p.claimedAt === null
      )
    ).toBe(true);

    updateSets.length = 0;

    // Catch path
    claimResults.push([baseRow({ id: "n3" })]);
    selectShouldThrow = true;
    await deliver("n3");
    selectShouldThrow = false;
    expect(
      updateSets.some(
        (p) =>
          p.emailStatus === "failed" &&
          p.claimedAt === null &&
          typeof p.lastError === "string"
      )
    ).toBe(true);
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

  it("LINE retryable failure then email success → line skipped; retry does not call LINE", async () => {
    includeLineChannel = true;
    claimResults.push([baseRow()]);
    selectResults.push(
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: true, lineEnabled: true, locale: "en" }]
    );
    lineSend.mockResolvedValue({
      ok: false,
      error: "line_http_503",
      retryable: true,
    });
    send.mockResolvedValue({ ok: true });

    await deliver("n1");

    expect(lineSend).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(updateSets.some((p) => p.lineStatus === "skipped")).toBe(true);
    expect(updateSets.some((p) => p.emailStatus === "sent")).toBe(true);

    // retryPending: row already has email sent → claim returns empty
    selectResults.push([]);
    claimResults.push([]);
    const count = await retryPending(new Date());
    expect(count).toBe(0);
    expect(lineSend).toHaveBeenCalledTimes(1);
  });

  it("LINE 429 (retryable:false) → line skipped, email sent, no retry", async () => {
    includeLineChannel = true;
    claimResults.push([baseRow()]);
    selectResults.push(
      [{ role: "worker", accountStatus: "active" }],
      [{ emailEnabled: true, lineEnabled: true, locale: "en" }]
    );
    lineSend.mockResolvedValue({
      ok: false,
      error: "line_quota_429",
      retryable: false,
    });
    send.mockResolvedValue({ ok: true });

    await deliver("n1");

    expect(lineSend).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(updateSets.some((p) => p.lineStatus === "skipped")).toBe(true);
    expect(updateSets.some((p) => p.emailStatus === "sent")).toBe(true);

    selectResults.push([]);
    claimResults.push([]);
    const count = await retryPending(new Date());
    expect(count).toBe(0);
    expect(lineSend).toHaveBeenCalledTimes(1);
  });
});
