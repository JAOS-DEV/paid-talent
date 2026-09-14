ALTER TABLE "profile_photos" ALTER COLUMN "photo_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_photos" ALTER COLUMN "photo_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_photos" ADD COLUMN "staging_key" text;