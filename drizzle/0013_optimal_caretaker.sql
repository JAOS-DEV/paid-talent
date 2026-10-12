CREATE TYPE "public"."contact_request_status" AS ENUM('queued', 'pending', 'accepted', 'declined', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('open', 'closed', 'blocked');--> statement-breakpoint
CREATE TABLE "contact_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recruiter_user_id" uuid NOT NULL,
	"recruiter_profile_id" uuid NOT NULL,
	"venue_id" uuid,
	"worker_profile_id" uuid NOT NULL,
	"worker_user_id" uuid NOT NULL,
	"opening_id" uuid,
	"opener_text" text NOT NULL,
	"follow_up_text" text,
	"follow_up_sent_at" timestamp,
	"status" "contact_request_status" DEFAULT 'pending' NOT NULL,
	"is_pro" boolean DEFAULT false NOT NULL,
	"is_top_talent_target" boolean DEFAULT false NOT NULL,
	"counts_toward_caps" boolean DEFAULT true NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"delivered_at" timestamp,
	"responded_at" timestamp,
	"expires_at" timestamp,
	"worker_hidden_at" timestamp,
	"legacy_interest_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_requests_legacy_interest_id_unique" UNIQUE("legacy_interest_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_request_id" uuid NOT NULL,
	"recruiter_user_id" uuid NOT NULL,
	"worker_user_id" uuid NOT NULL,
	"worker_profile_id" uuid NOT NULL,
	"venue_id" uuid,
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"retention_expires_at" timestamp,
	"legal_hold_until" timestamp,
	"worker_hidden_at" timestamp,
	"recruiter_hidden_at" timestamp,
	"worker_last_read_at" timestamp,
	"recruiter_last_read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_contact_request_id_unique" UNIQUE("contact_request_id")
);
--> statement-breakpoint
CREATE TABLE "user_notification_prefs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"line_enabled" boolean DEFAULT true NOT NULL,
	"locale" text DEFAULT 'th' NOT NULL,
	"inbound_daily_limit" integer,
	"inbound_paused" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hire_outcome_confirmation_requests" ADD COLUMN "contact_request_id" uuid;--> statement-breakpoint
ALTER TABLE "hire_outcomes" ADD COLUMN "contact_request_id" uuid;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_recruiter_user_id_users_id_fk" FOREIGN KEY ("recruiter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_recruiter_profile_id_recruiter_profiles_id_fk" FOREIGN KEY ("recruiter_profile_id") REFERENCES "public"."recruiter_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_worker_profile_id_worker_profiles_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_worker_user_id_users_id_fk" FOREIGN KEY ("worker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_opening_id_recruiter_openings_id_fk" FOREIGN KEY ("opening_id") REFERENCES "public"."recruiter_openings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_request_id_contact_requests_id_fk" FOREIGN KEY ("contact_request_id") REFERENCES "public"."contact_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_recruiter_user_id_users_id_fk" FOREIGN KEY ("recruiter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_worker_user_id_users_id_fk" FOREIGN KEY ("worker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_worker_profile_id_worker_profiles_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_prefs" ADD CONSTRAINT "user_notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_requests_recruiter_created_idx" ON "contact_requests" USING btree ("recruiter_user_id","created_at");--> statement-breakpoint
CREATE INDEX "contact_requests_worker_status_delivered_idx" ON "contact_requests" USING btree ("worker_profile_id","status","delivered_at");--> statement-breakpoint
CREATE INDEX "contact_requests_status_expires_idx" ON "contact_requests" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_requests_open_pair_uidx" ON "contact_requests" USING btree ("recruiter_user_id","worker_profile_id") WHERE "contact_requests"."status" IN ('queued', 'pending', 'accepted');--> statement-breakpoint
CREATE INDEX "conversations_worker_last_message_idx" ON "conversations" USING btree ("worker_user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_recruiter_last_message_idx" ON "conversations" USING btree ("recruiter_user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_retention_expires_idx" ON "conversations" USING btree ("retention_expires_at");--> statement-breakpoint
ALTER TABLE "hire_outcome_confirmation_requests" ADD CONSTRAINT "hire_outcome_confirmation_requests_contact_request_id_contact_requests_id_fk" FOREIGN KEY ("contact_request_id") REFERENCES "public"."contact_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hire_outcomes" ADD CONSTRAINT "hire_outcomes_contact_request_id_contact_requests_id_fk" FOREIGN KEY ("contact_request_id") REFERENCES "public"."contact_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hire_conf_req_contact_request_id_idx" ON "hire_outcome_confirmation_requests" USING btree ("contact_request_id");--> statement-breakpoint
CREATE INDEX "hire_outcomes_contact_request_id_idx" ON "hire_outcomes" USING btree ("contact_request_id");--> statement-breakpoint
-- Data migration: backfill contact_requests from profile_interests
INSERT INTO contact_requests (
  id,
  recruiter_user_id,
  recruiter_profile_id,
  venue_id,
  worker_profile_id,
  worker_user_id,
  opening_id,
  opener_text,
  status,
  is_pro,
  counts_toward_caps,
  delivered_at,
  expires_at,
  legacy_interest_id,
  created_at,
  updated_at
)
SELECT
  pi.id,
  pi.recruiter_user_id,
  rp.id,
  v.id,
  pi.worker_profile_id,
  wp.user_id,
  pi.opening_id,
  COALESCE(pi.message, ''),
  (CASE WHEN ho.status IN ('hired', 'started') THEN 'accepted' ELSE 'pending' END)::contact_request_status,
  false,
  false,
  pi.created_at,
  now() + interval '14 days',
  pi.id,
  pi.created_at,
  now()
FROM profile_interests pi
JOIN worker_profiles wp ON wp.id = pi.worker_profile_id
JOIN recruiter_profiles rp ON rp.user_id = pi.recruiter_user_id
LEFT JOIN venues v ON v.recruiter_profile_id = rp.id AND v.is_primary
LEFT JOIN hire_outcomes ho ON ho.interest_id = pi.id
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO conversations (
  contact_request_id,
  recruiter_user_id,
  worker_user_id,
  worker_profile_id,
  venue_id,
  last_activity_at,
  retention_expires_at,
  created_at
)
SELECT
  id,
  recruiter_user_id,
  worker_user_id,
  worker_profile_id,
  venue_id,
  now(),
  now() + interval '180 days',
  created_at
FROM contact_requests
WHERE status = 'accepted' AND legacy_interest_id IS NOT NULL;--> statement-breakpoint
UPDATE hire_outcomes
SET contact_request_id = interest_id
WHERE interest_id IN (SELECT id FROM contact_requests);--> statement-breakpoint
UPDATE hire_outcome_confirmation_requests
SET contact_request_id = interest_id
WHERE interest_id IN (SELECT id FROM contact_requests);