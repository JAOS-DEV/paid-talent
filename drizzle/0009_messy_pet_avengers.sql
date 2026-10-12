ALTER TYPE "public"."admin_audit_action" ADD VALUE 'recruiter_verification_approved' BEFORE 'photo_approved';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'recruiter_verification_rejected' BEFORE 'photo_approved';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'recruiter_verification_revoked' BEFORE 'photo_approved';--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "verification_status" "verification_status" DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "id_document_key" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "liveness_video_key" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "challenge_code" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "challenge_issued_at" timestamp;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "id_document_submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "verification_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "verification_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "verification_events" ADD COLUMN "recruiter_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_recruiter_profile_id_recruiter_profiles_id_fk" FOREIGN KEY ("recruiter_profile_id") REFERENCES "public"."recruiter_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recruiter_profiles_verification_status_idx" ON "recruiter_profiles" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "verification_events_recruiter_profile_id_idx" ON "verification_events" USING btree ("recruiter_profile_id");
--> statement-breakpoint
-- Backfill: keep is_verified in sync with verification_status; promote legacy is_verified rows.
UPDATE "recruiter_profiles"
SET
  "verification_status" = 'verified',
  "verified_at" = COALESCE("verified_at", NOW())
WHERE "is_verified" = true AND "verification_status" <> 'verified';
UPDATE "recruiter_profiles"
SET "is_verified" = ("verification_status" = 'verified');