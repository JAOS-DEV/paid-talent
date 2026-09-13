CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'top_talent_unlock');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'canceled', 'past_due', 'incomplete', 'trialing');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('worker', 'recruiter');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "profile_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recruiter_user_id" uuid NOT NULL,
	"worker_profile_id" uuid NOT NULL,
	"message" text,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_profile_id" uuid NOT NULL,
	"viewer_user_id" uuid,
	"viewer_ip_hash" text,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruiter_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_name" text,
	"organization_type" text,
	"website" text,
	"description" text,
	"location" text,
	"contact_email" text,
	"contact_phone" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recruiter_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"plan" "subscription_plan" DEFAULT 'free' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"name" text,
	"image" text,
	"role" "user_role" NOT NULL,
	"age_verified" boolean DEFAULT false NOT NULL,
	"date_of_birth" date,
	"age_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "worker_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"photo_key" text,
	"photo_url" text,
	"display_name" text NOT NULL,
	"location" text,
	"area" text,
	"description" text,
	"bio" text,
	"availability" text,
	"expected_pay_min" integer,
	"expected_pay_max" integer,
	"pay_currency" text DEFAULT 'USD',
	"job_roles" jsonb DEFAULT '[]'::jsonb,
	"experience" text,
	"experience_years" integer,
	"languages" jsonb DEFAULT '[]'::jsonb,
	"line_id" text,
	"whatsapp_number" text,
	"phone_number" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "worker_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_recruiter_user_id_users_id_fk" FOREIGN KEY ("recruiter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_worker_profile_id_worker_profiles_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_worker_profile_id_worker_profiles_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."worker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD CONSTRAINT "worker_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_idx" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "profile_interests_recruiter_idx" ON "profile_interests" USING btree ("recruiter_user_id");--> statement-breakpoint
CREATE INDEX "profile_interests_worker_idx" ON "profile_interests" USING btree ("worker_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_interests_unique_idx" ON "profile_interests" USING btree ("recruiter_user_id","worker_profile_id");--> statement-breakpoint
CREATE INDEX "profile_views_worker_profile_id_idx" ON "profile_views" USING btree ("worker_profile_id");--> statement-breakpoint
CREATE INDEX "profile_views_viewed_at_idx" ON "profile_views" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX "recruiter_profiles_user_id_idx" ON "recruiter_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_customer_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_tokens_identifier_token_idx" ON "verification_tokens" USING btree ("identifier","token");--> statement-breakpoint
CREATE INDEX "worker_profiles_user_id_idx" ON "worker_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "worker_profiles_area_idx" ON "worker_profiles" USING btree ("area");--> statement-breakpoint
CREATE INDEX "worker_profiles_is_published_idx" ON "worker_profiles" USING btree ("is_published");