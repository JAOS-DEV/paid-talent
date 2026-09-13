CREATE TYPE "public"."hire_outcome_status" AS ENUM('interested', 'hired', 'started');--> statement-breakpoint
CREATE TABLE "hire_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_id" uuid NOT NULL,
	"status" "hire_outcome_status" DEFAULT 'interested' NOT NULL,
	"hired_at" timestamp,
	"started_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hire_outcomes_interest_id_unique" UNIQUE("interest_id")
);
--> statement-breakpoint
ALTER TABLE "hire_outcomes" ADD CONSTRAINT "hire_outcomes_interest_id_profile_interests_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."profile_interests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hire_outcomes_interest_id_idx" ON "hire_outcomes" USING btree ("interest_id");--> statement-breakpoint
CREATE INDEX "hire_outcomes_status_idx" ON "hire_outcomes" USING btree ("status");