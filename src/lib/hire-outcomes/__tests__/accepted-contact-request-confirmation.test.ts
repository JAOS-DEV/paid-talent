import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const contactRequest = {
  id: "11111111-1111-4111-8111-111111111111",
  recruiterUserId: "recruiter-1",
  workerProfileId: "worker-profile-1",
  workerUserId: "worker-1",
  status: "accepted" as const,
  openerText: "Come work with us",
  openingId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const workerProfile = {
  id: "worker-profile-1",
  userId: "worker-1",
};

let pending: Record<string, unknown> | null = null;
let outcome: Record<string, unknown> | null = null;
const confirmationRequest = {
  id: "22222222-2222-4222-8222-222222222222",
  contactRequestId: contactRequest.id,
  requestedStatus: "hired" as const,
  requestStatus: "pending" as const,
  requestedByRecruiterUserId: "recruiter-1",
};

function limitFor(tableName: string) {
  if (tableName === "contactRequests") {
    return async () => [contactRequest];
  }
  if (tableName === "hireOutcomes") {
    return async () => (outcome ? [outcome] : []);
  }
  if (tableName === "confirmations") {
    return async () => (pending ? [pending] : []);
  }
  if (tableName === "joined") {
    return async () =>
      pending
        ? [
            {
              request: { ...confirmationRequest, ...pending },
              contactRequest,
              workerProfile,
            },
          ]
        : [];
  }
  return async () => [];
}

vi.mock("@/lib/db", () => {
  const db = {
    select: vi.fn(() => ({
      from: (table: { kind?: string }) => {
        const selectKind = table.kind ?? "contactRequests";
        return {
          where: () => ({
            limit: () => limitFor(selectKind)(),
          }),
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: () => limitFor("joined")(),
              }),
            }),
          }),
        };
      },
    })),
    insert: vi.fn((table: { kind?: string }) => ({
      values: (values: Record<string, unknown>) => {
        let applied = false;
        let rows: Record<string, unknown>[] = [];
        const apply = (): Record<string, unknown>[] => {
          if (applied) return rows;
          applied = true;
          if (table.kind === "confirmations") {
            pending = {
              ...confirmationRequest,
              ...values,
              requestStatus: "pending",
            };
            rows = [{ id: confirmationRequest.id }];
            return rows;
          }
          if (table.kind === "hireOutcomes") {
            outcome = {
              id: "outcome-1",
              status: values.status,
              hiredAt: values.hiredAt,
              startedAt: values.startedAt,
              contactRequestId: values.contactRequestId,
            };
            rows = [outcome];
            return rows;
          }
          return rows;
        };
        return {
          returning: async () => apply(),
          then: (
            onFulfilled: (value: Record<string, unknown>[]) => unknown,
            onRejected?: (reason: unknown) => unknown
          ) => Promise.resolve(apply()).then(onFulfilled, onRejected),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            if (pending) {
              pending = { ...pending, ...values };
            }
            if (values.status && outcome) {
              outcome = { ...outcome, ...values };
            }
            return [{ id: confirmationRequest.id }];
          },
        }),
      }),
    })),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };

  return {
    db,
    contactRequests: { kind: "contactRequests" },
    hireOutcomes: { kind: "hireOutcomes" },
    hireOutcomeConfirmationRequests: { kind: "confirmations" },
    workerProfiles: { kind: "workerProfiles" },
  };
});

describe("hire confirmation from an accepted contact request", () => {
  beforeEach(() => {
    pending = null;
    outcome = null;
  });

  it("confirms hired without a profile_interests row", async () => {
    const { requestConfirmation, respondToConfirmation } = await import(
      "../service"
    );
    const serviceSrc = readFileSync(
      join(process.cwd(), "src/lib/hire-outcomes/service.ts"),
      "utf8"
    );
    expect(serviceSrc).not.toContain("profileInterests");
    expect(serviceSrc).not.toContain("interest_id");

    const requested = await requestConfirmation({
      recruiterUserId: "recruiter-1",
      recruiterRole: "recruiter",
      interestId: contactRequest.id,
      requestedStatus: "hired",
    });
    expect(requested.success).toBe(true);
    expect(requested.requestId).toBe(confirmationRequest.id);

    const confirmed = await respondToConfirmation({
      workerUserId: "worker-1",
      workerRole: "worker",
      requestId: confirmationRequest.id,
      action: "confirm",
    });
    expect(confirmed.success).toBe(true);
    expect(confirmed.confirmedStatus).toBe("hired");
    expect(outcome).toMatchObject({
      status: "hired",
      contactRequestId: contactRequest.id,
    });
  });
});
