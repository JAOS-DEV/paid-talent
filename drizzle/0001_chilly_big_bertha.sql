CREATE TYPE "public"."photo_moderation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "profile_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"worker_profile_id" uuid NOT NULL,
	"photo_key" text NOT NULL,
	"photo_url" text NOT NULL,
	"moderation_status" "photo_moderation_status" DEFAULT 'pending' NOT NULL,
	"moderation_reason" text,
	"moderation_confidence" integer,
	"moderation_categories" jsonb,
	"moderation_reviewed_at" timestamp,
	"moderation_reviewed_by" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_current_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_worker_profile_id_worker_profiles_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_photos_user_id_idx" ON "profile_photos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profile_photos_worker_profile_id_idx" ON "profile_photos" USING btree ("worker_profile_id");--> statement-breakpoint
CREATE INDEX "profile_photos_moderation_status_idx" ON "profile_photos" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "profile_photos_is_current_approved_idx" ON "profile_photos" USING btree ("is_current_approved");