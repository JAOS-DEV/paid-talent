ALTER TABLE "worker_profiles" ALTER COLUMN "availability" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "worker_profiles" ALTER COLUMN "availability" SET DATA TYPE jsonb USING (
  CASE
    WHEN "availability" IS NULL THEN '[]'::jsonb
    WHEN btrim("availability") = '' THEN '[]'::jsonb
    WHEN left(btrim("availability"), 1) = '[' THEN "availability"::jsonb
    ELSE jsonb_build_array("availability")
  END
);--> statement-breakpoint
ALTER TABLE "worker_profiles" ALTER COLUMN "availability" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "worker_profiles" ALTER COLUMN "availability" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "worker_profiles" ALTER COLUMN "pay_currency" SET DEFAULT 'THB';
