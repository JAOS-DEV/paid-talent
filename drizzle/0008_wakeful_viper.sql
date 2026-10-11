CREATE TYPE "public"."worker_expected_pay_period" AS ENUM('day', 'month');--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "expected_pay_period" "worker_expected_pay_period";--> statement-breakpoint
UPDATE "worker_profiles"
SET
  "expected_pay_min" = COALESCE("expected_pay_min", "expected_pay_max"),
  "expected_pay_period" = 'day'
WHERE COALESCE("expected_pay_min", "expected_pay_max") IS NOT NULL;
