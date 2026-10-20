-- Backfill hire outcomes onto contact requests before any constraint change.
-- Mapping: contact_requests.legacy_interest_id = interest_id (legacy rows)
-- or contact_requests.id = interest_id (shadow rows created with the same id).
DO $$
DECLARE
  ambiguous integer;
BEGIN
  SELECT count(*) INTO ambiguous
  FROM "hire_outcomes" ho
  WHERE ho."contact_request_id" IS NULL
    AND (
      SELECT count(*)
      FROM "contact_requests" cr
      WHERE cr."legacy_interest_id" = ho."interest_id"
         OR cr."id" = ho."interest_id"
    ) > 1;

  IF ambiguous > 0 THEN
    RAISE EXCEPTION 'hire_outcomes backfill is ambiguous for % row(s)', ambiguous;
  END IF;
END $$;
--> statement-breakpoint
UPDATE "hire_outcomes" AS ho
SET "contact_request_id" = cr."id"
FROM "contact_requests" AS cr
WHERE ho."contact_request_id" IS NULL
  AND (
    cr."legacy_interest_id" = ho."interest_id"
    OR cr."id" = ho."interest_id"
  );
--> statement-breakpoint
DO $$
DECLARE
  unmapped integer;
BEGIN
  SELECT count(*) INTO unmapped
  FROM "hire_outcomes"
  WHERE "contact_request_id" IS NULL;

  IF unmapped > 0 THEN
    RAISE EXCEPTION 'hire_outcomes rows remain without contact_request_id (% row(s))', unmapped;
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  ambiguous integer;
BEGIN
  SELECT count(*) INTO ambiguous
  FROM "hire_outcome_confirmation_requests" req
  WHERE req."contact_request_id" IS NULL
    AND (
      SELECT count(*)
      FROM "contact_requests" cr
      WHERE cr."legacy_interest_id" = req."interest_id"
         OR cr."id" = req."interest_id"
    ) > 1;

  IF ambiguous > 0 THEN
    RAISE EXCEPTION 'hire_outcome_confirmation_requests backfill is ambiguous for % row(s)', ambiguous;
  END IF;
END $$;
--> statement-breakpoint
UPDATE "hire_outcome_confirmation_requests" AS req
SET "contact_request_id" = cr."id"
FROM "contact_requests" AS cr
WHERE req."contact_request_id" IS NULL
  AND (
    cr."legacy_interest_id" = req."interest_id"
    OR cr."id" = req."interest_id"
  );
--> statement-breakpoint
DO $$
DECLARE
  unmapped integer;
BEGIN
  SELECT count(*) INTO unmapped
  FROM "hire_outcome_confirmation_requests"
  WHERE "contact_request_id" IS NULL;

  IF unmapped > 0 THEN
    RAISE EXCEPTION 'hire_outcome_confirmation_requests rows remain without contact_request_id (% row(s))', unmapped;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "hire_outcomes" DROP CONSTRAINT "hire_outcomes_interest_id_unique";--> statement-breakpoint
ALTER TABLE "hire_outcome_confirmation_requests" DROP CONSTRAINT "hire_outcome_confirmation_requests_interest_id_profile_interests_id_fk";
--> statement-breakpoint
ALTER TABLE "hire_outcomes" DROP CONSTRAINT "hire_outcomes_interest_id_profile_interests_id_fk";
--> statement-breakpoint
ALTER TABLE "hire_outcomes" DROP CONSTRAINT "hire_outcomes_contact_request_id_contact_requests_id_fk";
--> statement-breakpoint
DROP INDEX "hire_conf_req_interest_id_idx";--> statement-breakpoint
DROP INDEX "hire_conf_req_one_pending_per_interest_uidx";--> statement-breakpoint
DROP INDEX "hire_outcomes_interest_id_idx";--> statement-breakpoint
ALTER TABLE "hire_outcome_confirmation_requests" ALTER COLUMN "contact_request_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "hire_outcomes" ALTER COLUMN "contact_request_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "hire_outcomes" ADD CONSTRAINT "hire_outcomes_contact_request_id_contact_requests_id_fk" FOREIGN KEY ("contact_request_id") REFERENCES "public"."contact_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hire_conf_req_one_pending_per_contact_request_uidx" ON "hire_outcome_confirmation_requests" USING btree ("contact_request_id") WHERE "hire_outcome_confirmation_requests"."request_status" = 'pending';--> statement-breakpoint
ALTER TABLE "hire_outcome_confirmation_requests" DROP COLUMN "interest_id";--> statement-breakpoint
ALTER TABLE "hire_outcomes" DROP COLUMN "interest_id";--> statement-breakpoint
ALTER TABLE "hire_outcomes" ADD CONSTRAINT "hire_outcomes_contact_request_id_unique" UNIQUE("contact_request_id");--> statement-breakpoint
ALTER TABLE "profile_interests" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "profile_interests" CASCADE;