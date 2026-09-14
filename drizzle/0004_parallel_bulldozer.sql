CREATE TYPE "public"."hire_confirmation_request_status" AS ENUM('pending', 'confirmed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hire_confirmation_requested_status" AS ENUM('hired', 'started');--> statement-breakpoint
CREATE TABLE "hire_outcome_confirmation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_id" uuid NOT NULL,
	"requested_status" "hire_confirmation_requested_status" NOT NULL,
	"request_status" "hire_confirmation_request_status" DEFAULT 'pending' NOT NULL,
	"requested_by_recruiter_user_id" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"responded_by_worker_user_id" uuid,
	"responded_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hire_outcome_confirmation_requests" ADD CONSTRAINT "hire_outcome_confirmation_requests_interest_id_profile_interests_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."profile_interests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hire_outcome_confirmation_requests" ADD CONSTRAINT "hire_outcome_confirmation_requests_requested_by_recruiter_user_id_users_id_fk" FOREIGN KEY ("requested_by_recruiter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hire_outcome_confirmation_requests" ADD CONSTRAINT "hire_outcome_confirmation_requests_responded_by_worker_user_id_users_id_fk" FOREIGN KEY ("responded_by_worker_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hire_conf_req_interest_id_idx" ON "hire_outcome_confirmation_requests" USING btree ("interest_id");--> statement-breakpoint
CREATE INDEX "hire_conf_req_request_status_idx" ON "hire_outcome_confirmation_requests" USING btree ("request_status");--> statement-breakpoint
CREATE INDEX "hire_conf_req_requested_by_idx" ON "hire_outcome_confirmation_requests" USING btree ("requested_by_recruiter_user_id");--> statement-breakpoint
CREATE INDEX "hire_conf_req_pending_requested_at_idx" ON "hire_outcome_confirmation_requests" USING btree ("request_status","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hire_conf_req_one_pending_per_interest_uidx" ON "hire_outcome_confirmation_requests" USING btree ("interest_id") WHERE "hire_outcome_confirmation_requests"."request_status" = 'pending';