ALTER TYPE "public"."admin_audit_action" ADD VALUE 'account_deletion_requested';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'account_deletion_cancelled';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_requested_at" timestamp;--> statement-breakpoint
CREATE INDEX "users_deletion_requested_at_idx" ON "users" USING btree ("deletion_requested_at");