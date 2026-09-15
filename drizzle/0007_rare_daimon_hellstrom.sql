ALTER TABLE "worker_profiles" ALTER COLUMN "availability" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "worker_profiles" ALTER COLUMN "availability" SET DATA TYPE jsonb USING (
  CASE
    WHEN "availability" IS NULL THEN '[]'::jsonb
    WHEN btrim("availability") = '' THEN '[]'::jsonb
    ELSE jsonb_build_array(btrim("availability"))
  END
);--> statement-breakpoint
ALTER TABLE "worker_profiles" ALTER COLUMN "availability" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "worker_profiles" ALTER COLUMN "availability" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "worker_profiles" ALTER COLUMN "pay_currency" SET DEFAULT 'THB';
