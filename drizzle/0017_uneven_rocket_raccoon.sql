CREATE TABLE "line_links" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"line_user_id" text NOT NULL,
	"display_name" text,
	"is_friend" boolean DEFAULT false NOT NULL,
	"friend_status_updated_at" timestamp,
	"linked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_push_usage" (
	"month" text PRIMARY KEY NOT NULL,
	"pushes_sent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "line_links" ADD CONSTRAINT "line_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "line_links_line_user_id_uidx" ON "line_links" USING btree ("line_user_id");