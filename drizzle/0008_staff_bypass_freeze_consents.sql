ALTER TYPE "public"."user_role" ADD VALUE 'staff' BEFORE 'member';--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document" text NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "subscription_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"provider_message_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pause_resumes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "access_logs" ADD COLUMN "actor_id" uuid;--> statement-breakpoint
ALTER TABLE "access_logs" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_reminders" ADD CONSTRAINT "subscription_reminders_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_consents_user_document_version_idx" ON "user_consents" USING btree ("user_id","document","version");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_reminders_once_idx" ON "subscription_reminders" USING btree ("subscription_id","kind","period_end");--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;