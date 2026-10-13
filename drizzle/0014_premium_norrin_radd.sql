CREATE TYPE "public"."contact_share_channel" AS ENUM('line', 'phone', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."flag_target" AS ENUM('message', 'contact_request', 'blocked_attempt');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'system', 'contact_share');--> statement-breakpoint
CREATE TABLE "contact_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"sharer_user_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"channel" "contact_share_channel" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" "flag_target" NOT NULL,
	"message_id" uuid,
	"contact_request_id" uuid,
	"conversation_id" uuid,
	"author_user_id" uuid,
	"categories" jsonb NOT NULL,
	"matched_terms" jsonb NOT NULL,
	"excerpt" text,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid,
	"kind" "message_kind" DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_shares" ADD CONSTRAINT "contact_shares_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_shares" ADD CONSTRAINT "contact_shares_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_shares" ADD CONSTRAINT "contact_shares_sharer_user_id_users_id_fk" FOREIGN KEY ("sharer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_shares" ADD CONSTRAINT "contact_shares_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_flags" ADD CONSTRAINT "message_flags_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_flags" ADD CONSTRAINT "message_flags_contact_request_id_contact_requests_id_fk" FOREIGN KEY ("contact_request_id") REFERENCES "public"."contact_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_flags" ADD CONSTRAINT "message_flags_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_flags" ADD CONSTRAINT "message_flags_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_shares_conversation_idx" ON "contact_shares" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "message_flags_status_created_idx" ON "message_flags" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "message_flags_author_user_id_idx" ON "message_flags" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");