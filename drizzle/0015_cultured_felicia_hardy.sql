CREATE TYPE "public"."report_reason" AS ENUM('scam_or_fake_job', 'asked_for_money', 'asked_for_documents', 'harassment', 'sexual_content', 'underage_concern', 'trafficking_concern', 'spam', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewing', 'actioned', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'report_resolved';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'message_flag_reviewed';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'recruiter_messaging_paused';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'recruiter_messaging_unpaused';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'conversation_viewed';--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid,
	"reported_user_id" uuid,
	"contact_request_id" uuid,
	"conversation_id" uuid,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"evidence_snapshot" jsonb,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "messaging_paused_at" timestamp;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "messaging_paused_reason" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "messaging_paused_by" text;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_contact_request_id_contact_requests_id_fk" FOREIGN KEY ("contact_request_id") REFERENCES "public"."contact_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_user_id_users_id_fk" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_reported_user_created_idx" ON "reports" USING btree ("reported_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_blocks_blocker_blocked_uidx" ON "user_blocks" USING btree ("blocker_user_id","blocked_user_id");--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_user_id_idx" ON "user_blocks" USING btree ("blocked_user_id");