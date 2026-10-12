CREATE TYPE "public"."venue_link_kind" AS ENUM('google_maps', 'facebook', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."venue_review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'venue_approved' BEFORE 'photo_approved';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'venue_rejected' BEFORE 'photo_approved';--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recruiter_profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"venue_type" text,
	"area" text,
	"sub_area" text,
	"blurb" text,
	"logo_key" text,
	"logo_url" text,
	"venue_link_url" text NOT NULL,
	"venue_link_kind" "venue_link_kind" NOT NULL,
	"review_status" "venue_review_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"business_doc_key" text,
	"business_verified_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recruiter_openings" ADD COLUMN "venue_id" uuid;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "line_id" text;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_recruiter_profile_id_recruiter_profiles_id_fk" FOREIGN KEY ("recruiter_profile_id") REFERENCES "public"."recruiter_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venues_recruiter_profile_id_idx" ON "venues" USING btree ("recruiter_profile_id");--> statement-breakpoint
CREATE INDEX "venues_review_status_idx" ON "venues" USING btree ("review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "venues_one_primary_per_recruiter_uidx" ON "venues" USING btree ("recruiter_profile_id") WHERE "venues"."is_primary" = true;--> statement-breakpoint
ALTER TABLE "recruiter_openings" ADD CONSTRAINT "recruiter_openings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recruiter_openings_venue_id_idx" ON "recruiter_openings" USING btree ("venue_id");
--> statement-breakpoint
-- Backfill: one primary venue per recruiter_profiles row from legacy org fields.
INSERT INTO "venues" (
  "recruiter_profile_id",
  "name",
  "venue_type",
  "area",
  "sub_area",
  "blurb",
  "logo_key",
  "logo_url",
  "venue_link_url",
  "venue_link_kind",
  "review_status",
  "is_primary",
  "created_at",
  "updated_at"
)
SELECT
  rp."id",
  COALESCE(NULLIF(rp."organization_name", ''), 'My venue'),
  rp."organization_type",
  rp."area",
  rp."sub_area",
  rp."blurb",
  rp."logo_key",
  rp."logo_url",
  COALESCE(rp."website", ''),
  CASE
    WHEN COALESCE(rp."website", '') ILIKE '%google.%/maps%'
      OR COALESCE(rp."website", '') ILIKE '%maps.app.goo.gl%'
      THEN 'google_maps'::"venue_link_kind"
    WHEN COALESCE(rp."website", '') ILIKE '%facebook.com%'
      OR COALESCE(rp."website", '') ILIKE '%fb.com%'
      THEN 'facebook'::"venue_link_kind"
    WHEN COALESCE(rp."website", '') ILIKE '%instagram.com%'
      THEN 'instagram'::"venue_link_kind"
    ELSE 'google_maps'::"venue_link_kind"
  END,
  'pending'::"venue_review_status",
  true,
  NOW(),
  NOW()
FROM "recruiter_profiles" rp
WHERE NOT EXISTS (
  SELECT 1 FROM "venues" v WHERE v."recruiter_profile_id" = rp."id"
);
--> statement-breakpoint
UPDATE "recruiter_openings" ro
SET "venue_id" = v."id"
FROM "venues" v
WHERE v."recruiter_profile_id" = ro."recruiter_profile_id"
  AND v."is_primary" = true
  AND ro."venue_id" IS NULL;