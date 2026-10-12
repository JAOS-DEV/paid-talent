CREATE TYPE "public"."billing_product" AS ENUM('monthly', 'annual', 'pass_7d');--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'billing_prices_changed' BEFORE 'identity_verification_approved';--> statement-breakpoint
CREATE TABLE "billing_price_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"monthly_price_id" text,
	"annual_price_id" text,
	"pass_7d_price_id" text,
	"launch_coupon_id" text,
	"launch_enabled" boolean DEFAULT false NOT NULL,
	"launch_seats_limit" integer DEFAULT 50 NOT NULL,
	"first_pass_coupon_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "top_talent_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_checkout_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"amount_total" integer,
	"currency" text,
	"used_first_pass_coupon" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "top_talent_passes_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "billing_product" "billing_product";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "launch_discount_applied" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "top_talent_passes" ADD CONSTRAINT "top_talent_passes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "top_talent_passes_user_expires_idx" ON "top_talent_passes" USING btree ("user_id","expires_at");