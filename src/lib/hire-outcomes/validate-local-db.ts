import "./load-env-guard";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  hireOutcomeConfirmationRequests,
  hireOutcomes,
  profileInterests,
  recruiterProfiles,
  users,
  workerProfiles,
} from "../db";
import {
  requestConfirmation,
  respondToConfirmation,
} from "./service";

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

const checks: Check[] = [];

function assert(name: string, ok: boolean, detail?: string): void {
  checks.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

function failFast(name: string, ok: boolean, detail?: string): void {
  assert(name, ok, detail);
  if (!ok) {
    throw new Error(`Assertion failed: ${name}`);
  }
}

async function insertUser(role: "worker" | "recruiter", email: string) {
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: email.split("@")[0],
      role,
      ageVerified: true,
      dateOfBirth: "1990-01-01",
      ageVerifiedAt: new Date(),
    })
    .returning();
  return user;
}

async function insertWorker(userId: string, displayName: string) {
  const [profile] = await db
    .insert(workerProfiles)
    .values({
      userId,
      displayName,
      availability: "Full-time",
      isPublished: true,
      location: "Pattaya",
      area: "Central Pattaya",
    })
    .returning();
  return profile;
}

async function insertInterest(recruiterUserId: string, workerProfileId: string) {
  const [interest] = await db
    .insert(profileInterests)
    .values({
      recruiterUserId,
      workerProfileId,
      message: "local validation",
    })
    .returning();
  return interest;
}

async function countPending(interestId: string): Promise<number> {
  const rows = await db
    .select({ id: hireOutcomeConfirmationRequests.id })
    .from(hireOutcomeConfirmationRequests)
    .where(
      and(
        eq(hireOutcomeConfirmationRequests.interestId, interestId),
        eq(hireOutcomeConfirmationRequests.requestStatus, "pending")
      )
    );
  return rows.length;
}

async function getOutcome(interestId: string) {
  const [row] = await db
    .select()
    .from(hireOutcomes)
    .where(eq(hireOutcomes.interestId, interestId))
    .limit(1);
  return row ?? null;
}

async function getWorker(id: string) {
  const [row] = await db
    .select()
    .from(workerProfiles)
    .where(eq(workerProfiles.id, id))
    .limit(1);
  return row;
}

async function main(): Promise<void> {
  const suffix = randomUUID().slice(0, 8);

  const recruiterA = await insertUser("recruiter", `ra-${suffix}@local.test`);
  const recruiterB = await insertUser("recruiter", `rb-${suffix}@local.test`);
  const recruiterC = await insertUser("recruiter", `rc-${suffix}@local.test`);
  const workerAUser = await insertUser("worker", `wa-${suffix}@local.test`);
  const workerBUser = await insertUser("worker", `wb-${suffix}@local.test`);
  const workerCUser = await insertUser("worker", `wc-${suffix}@local.test`);
  const workerDUser = await insertUser("worker", `wd-${suffix}@local.test`);
  const dummyResponder = await insertUser("worker", `dummy-${suffix}@local.test`);

  await db.insert(recruiterProfiles).values({
    userId: recruiterA.id,
    organizationName: "Local Venue A",
  });

  const workerA = await insertWorker(workerAUser.id, "Worker A");
  const workerB = await insertWorker(workerBUser.id, "Worker B");
  const workerC = await insertWorker(workerCUser.id, "Worker C");
  const workerD = await insertWorker(workerDUser.id, "Worker D");

  const interestA = await insertInterest(recruiterA.id, workerA.id);
  const interestB = await insertInterest(recruiterB.id, workerB.id);
  const interestC = await insertInterest(recruiterC.id, workerC.id);
  const interestD = await insertInterest(recruiterA.id, workerD.id);
  const interestCascade = await insertInterest(recruiterA.id, workerB.id);

  const legacyHiredAt = new Date("2025-06-01T00:00:00.000Z");
  const legacyStartedAt = new Date("2025-06-15T00:00:00.000Z");
  await db.insert(hireOutcomes).values({
    interestId: interestD.id,
    status: "started",
    hiredAt: legacyHiredAt,
    startedAt: legacyStartedAt,
    notes: "legacy confirmed",
  });
  await db.insert(hireOutcomes).values({
    interestId: interestC.id,
    status: "hired",
    hiredAt: new Date("2025-07-01T00:00:00.000Z"),
    startedAt: null,
    notes: "legacy hired",
  });

  const beforeLegacy = await getOutcome(interestD.id);

  // --- request hire does not confirm ---
  const requestHire = await requestConfirmation({
    recruiterUserId: recruiterA.id,
    recruiterRole: "recruiter",
    interestId: interestA.id,
    requestedStatus: "hired",
  });
  failFast("request hire succeeds", requestHire.success === true, requestHire.error);
  const afterRequestOutcome = await getOutcome(interestA.id);
  assert(
    "request hire does not set confirmed hired",
    afterRequestOutcome === null || afterRequestOutcome.status === "interested"
  );
  assert("pending hire row exists", (await countPending(interestA.id)) === 1);

  const duplicate = await requestConfirmation({
    recruiterUserId: recruiterA.id,
    recruiterRole: "recruiter",
    interestId: interestA.id,
    requestedStatus: "hired",
  });
  assert(
    "duplicate request is idempotent",
    duplicate.success === true && duplicate.alreadyPending === true
  );
  assert("still only one pending row", (await countPending(interestA.id)) === 1);

  try {
    await db.insert(hireOutcomeConfirmationRequests).values({
      interestId: interestA.id,
      requestedStatus: "hired",
      requestStatus: "pending",
      requestedByRecruiterUserId: recruiterA.id,
    });
    const pendingAfterIllegal = await countPending(interestA.id);
    assert(
      "DB unique pending constraint blocks second insert",
      false,
      `insert succeeded; pending count=${pendingAfterIllegal}`
    );
  } catch (error) {
    const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
    const cause =
      record.cause && typeof record.cause === "object"
        ? (record.cause as Record<string, unknown>)
        : {};
    const code = String(record.code ?? cause.code ?? "");
    const message = String(record.message ?? cause.message ?? "");
    assert(
      "DB unique pending constraint blocks second insert",
      code === "23505" || message.includes("hire_conf_req_one_pending_per_interest_uidx"),
      `code=${code || "none"}`
    );
  }

  const publishedBefore = (await getWorker(workerA.id))!;
  const confirmBefore = Date.now();
  const confirmHire = await respondToConfirmation({
    workerUserId: workerAUser.id,
    workerRole: "worker",
    requestId: requestHire.requestId!,
    action: "confirm",
  });
  failFast("worker confirms hire", confirmHire.success === true, confirmHire.error);
  const hiredOutcome = await getOutcome(interestA.id);
  assert("confirmed outcome is hired", hiredOutcome?.status === "hired");
  assert(
    "hiredAt populated at confirmation time",
    hiredOutcome?.hiredAt instanceof Date &&
      hiredOutcome.hiredAt.getTime() >= confirmBefore - 1000
  );
  const publishedAfterHire = (await getWorker(workerA.id))!;
  assert(
    "confirm hire does not change isPublished",
    publishedAfterHire.isPublished === publishedBefore.isPublished
  );
  assert(
    "confirm hire does not change availability",
    publishedAfterHire.availability === publishedBefore.availability
  );

  // --- reject hire ---
  const requestHireB = await requestConfirmation({
    recruiterUserId: recruiterB.id,
    recruiterRole: "recruiter",
    interestId: interestB.id,
    requestedStatus: "hired",
  });
  failFast("request hire B succeeds", requestHireB.success === true, requestHireB.error);
  const rejectHire = await respondToConfirmation({
    workerUserId: workerBUser.id,
    workerRole: "worker",
    requestId: requestHireB.requestId!,
    action: "reject",
  });
  failFast("worker rejects hire", rejectHire.success === true, rejectHire.error);
  const rejectedOutcome = await getOutcome(interestB.id);
  assert(
    "reject hire leaves outcome interested/absent",
    rejectedOutcome === null || rejectedOutcome.status === "interested"
  );
  assert("reject hire does not set hiredAt", rejectedOutcome?.hiredAt == null);

  const requestHireB2 = await requestConfirmation({
    recruiterUserId: recruiterB.id,
    recruiterRole: "recruiter",
    interestId: interestB.id,
    requestedStatus: "hired",
  });
  failFast("can request hire again after rejection", requestHireB2.success === true);
  const historyB = await db
    .select()
    .from(hireOutcomeConfirmationRequests)
    .where(eq(hireOutcomeConfirmationRequests.interestId, interestB.id));
  assert(
    "historical rejected + new pending allowed",
    historyB.length === 2 &&
      historyB.filter((row) => row.requestStatus === "pending").length === 1 &&
      historyB.filter((row) => row.requestStatus === "rejected").length === 1
  );

  // --- request start does not set started ---
  const requestStart = await requestConfirmation({
    recruiterUserId: recruiterA.id,
    recruiterRole: "recruiter",
    interestId: interestA.id,
    requestedStatus: "started",
  });
  failFast("request start succeeds", requestStart.success === true, requestStart.error);
  const pendingStartOutcome = await getOutcome(interestA.id);
  assert("pending start still hired", pendingStartOutcome?.status === "hired");
  assert("pending start does not set startedAt", pendingStartOutcome?.startedAt == null);

  const confirmStart = await respondToConfirmation({
    workerUserId: workerAUser.id,
    workerRole: "worker",
    requestId: requestStart.requestId!,
    action: "confirm",
  });
  failFast("worker confirms start", confirmStart.success === true, confirmStart.error);
  const startedOutcome = await getOutcome(interestA.id);
  assert("confirmed outcome is started", startedOutcome?.status === "started");
  assert(
    "hiredAt preserved after start",
    startedOutcome?.hiredAt?.getTime() === hiredOutcome?.hiredAt?.getTime()
  );
  assert("startedAt populated", startedOutcome?.startedAt instanceof Date);
  const publishedAfterStart = (await getWorker(workerA.id))!;
  assert(
    "confirm start does not change isPublished",
    publishedAfterStart.isPublished === true
  );
  assert(
    "confirm start does not change availability",
    publishedAfterStart.availability === "Full-time"
  );

  // --- reject start ---
  const requestStartC = await requestConfirmation({
    recruiterUserId: recruiterC.id,
    recruiterRole: "recruiter",
    interestId: interestC.id,
    requestedStatus: "started",
  });
  failFast("request start on legacy hired succeeds", requestStartC.success === true, requestStartC.error);
  const rejectStart = await respondToConfirmation({
    workerUserId: workerCUser.id,
    workerRole: "worker",
    requestId: requestStartC.requestId!,
    action: "reject",
  });
  failFast("worker rejects start", rejectStart.success === true, rejectStart.error);
  const stillHired = await getOutcome(interestC.id);
  assert("reject start remains hired", stillHired?.status === "hired");
  assert("reject start keeps startedAt null", stillHired?.startedAt == null);

  const afterLegacy = await getOutcome(interestD.id);
  assert("legacy started row status unchanged", afterLegacy?.status === "started");
  assert(
    "legacy hiredAt unchanged",
    afterLegacy?.hiredAt?.getTime() === beforeLegacy?.hiredAt?.getTime()
  );
  assert(
    "legacy startedAt unchanged",
    afterLegacy?.startedAt?.getTime() === beforeLegacy?.startedAt?.getTime()
  );

  // --- FKs ---
  await db.insert(hireOutcomeConfirmationRequests).values({
    interestId: interestCascade.id,
    requestedStatus: "hired",
    requestStatus: "pending",
    requestedByRecruiterUserId: recruiterA.id,
  });
  await db.delete(profileInterests).where(eq(profileInterests.id, interestCascade.id));
  const cascaded = await db
    .select()
    .from(hireOutcomeConfirmationRequests)
    .where(eq(hireOutcomeConfirmationRequests.interestId, interestCascade.id));
  assert("deleting interest cascades confirmation requests", cascaded.length === 0);

  await db
    .update(hireOutcomeConfirmationRequests)
    .set({ respondedByWorkerUserId: dummyResponder.id })
    .where(eq(hireOutcomeConfirmationRequests.id, requestHireB.requestId!));
  await db.delete(users).where(eq(users.id, dummyResponder.id));
  const [afterSetNull] = await db
    .select()
    .from(hireOutcomeConfirmationRequests)
    .where(eq(hireOutcomeConfirmationRequests.id, requestHireB.requestId!));
  assert(
    "deleting responder user sets responded_by to null",
    afterSetNull?.respondedByWorkerUserId === null
  );

  const failed = checks.filter((check) => !check.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("VALIDATION_FAILED");
  console.error(error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
