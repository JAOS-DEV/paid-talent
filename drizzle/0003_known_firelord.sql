CREATE TABLE "recruiter_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recruiter_profile_id" uuid NOT NULL,
	"role" text NOT NULL,
	"area" text NOT NULL,
	"pay_min" integer,
	"pay_max" integer,
	"pay_currency" text DEFAULT 'THB' NOT NULL,
	"pay_period" text DEFAULT 'night' NOT NULL,
	"notes" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_interests" ADD COLUMN "opening_id" uuid;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "logo_key" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "area" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "sub_area" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "blurb" text;--> statement-breakpoint
ALTER TABLE "recruiter_openings" ADD CONSTRAINT "recruiter_openings_recruiter_profile_id_recruiter_profiles_id_fk" FOREIGN KEY ("recruiter_profile_id") REFERENCES "public"."recruiter_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recruiter_openings_recruiter_profile_id_idx" ON "recruiter_openings" USING btree ("recruiter_profile_id");--> statement-breakpoint
CREATE INDEX "recruiter_openings_area_idx" ON "recruiter_openings" USING btree ("area");--> statement-breakpoint
CREATE INDEX "recruiter_openings_is_published_idx" ON "recruiter_openings" USING btree ("is_published");--> statement-breakpoint
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_opening_id_recruiter_openings_id_fk" FOREIGN KEY ("opening_id") REFERENCES "public"."recruiter_openings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_interests_opening_idx" ON "profile_interests" USING btree ("opening_id");--> statement-breakpoint
CREATE INDEX "recruiter_profiles_area_idx" ON "recruiter_profiles" USING btree ("area");