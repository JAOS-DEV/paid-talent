CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('contact_request_received', 'contact_request_accepted', 'contact_request_declined', 'new_message', 'contact_shared', 'verification_approved', 'verification_rejected', 'venue_approved', 'venue_rejected', 'messaging_paused', 'safety_notice');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"dedupe_key" text,
	"read_at" timestamp,
	"email_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"line_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"email_sent_at" timestamp,
	"line_sent_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "notifications_delivery_created_idx" ON "notifications" USING btree ("email_status","line_status","created_at");