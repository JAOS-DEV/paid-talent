CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'banned');--> statement-breakpoint
CREATE TYPE "public"."admin_audit_action" AS ENUM('account_suspended', 'account_reactivated', 'account_banned', 'ban_lifted', 'admin_premium_granted', 'admin_premium_extended', 'lifetime_premium_granted', 'admin_premium_revoked', 'subscription_paywall_mode_changed', 'identity_verification_approved', 'identity_verification_rejected', 'identity_verification_revoked', 'photo_approved', 'photo_rejected');--> statement-breakpoint
CREATE TYPE "public"."admin_entitlement_kind" AS ENUM('top_talent_unlock');--> statement-breakpoint
CREATE TYPE "public"."billing_access_mode" AS ENUM('enforced', 'open_access');--> statement-breakpoint
CREATE TABLE "admin_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "admin_audit_action" NOT NULL,
	"actor_admin_email" text NOT NULL,
	"actor_user_id" uuid,
	"target_user_id" uuid,
	"target_identity" text,
	"target_type" text NOT NULL,
	"target_id" text,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "admin_entitlement_kind" DEFAULT 'top_talent_unlock' NOT NULL,
	"starts_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"is_lifetime" boolean DEFAULT false NOT NULL,
	"reason" text NOT NULL,
	"granted_by_admin_email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"revoked_by_admin_email" text,
	"revocation_reason" text
);
--> statement-breakpoint
CREATE TABLE "banned_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_email" text NOT NULL,
	"original_user_id" uuid,
	"reason" text NOT NULL,
	"banned_at" timestamp DEFAULT now() NOT NULL,
	"banned_by_admin_email" text NOT NULL,
	"lifted_at" timestamp,
	"lifted_by_admin_email" text
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_access_mode" "billing_access_mode" DEFAULT 'enforced' NOT NULL,
	"billing_access_mode_reason" text,
	"billing_access_mode_updated_at" timestamp,
	"billing_access_mode_updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status_changed_by" text;--> statement-breakpoint
ALTER TABLE "admin_entitlements" ADD CONSTRAINT "admin_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_events_created_at_idx" ON "admin_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_events_action_idx" ON "admin_audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "admin_audit_events_target_user_id_idx" ON "admin_audit_events" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "admin_entitlements_user_id_idx" ON "admin_entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_entitlements_active_user_kind_uidx" ON "admin_entitlements" USING btree ("user_id","kind") WHERE "admin_entitlements"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "banned_identities_normalized_email_idx" ON "banned_identities" USING btree ("normalized_email");--> statement-breakpoint
CREATE UNIQUE INDEX "banned_identities_active_email_uidx" ON "banned_identities" USING btree ("normalized_email") WHERE "banned_identities"."lifted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_account_status_idx" ON "users" USING btree ("account_status");
--> statement-breakpoint
INSERT INTO "platform_settings" ("id", "billing_access_mode", "updated_at")
VALUES ('default', 'enforced', now())
ON CONFLICT ("id") DO NOTHING;