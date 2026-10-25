CREATE TABLE "access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"token_id" text,
	"gate_id" text,
	"granted" boolean NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_logs_user_id_created_at_idx" ON "access_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "access_logs_token_id_granted_idx" ON "access_logs" USING btree ("token_id") WHERE "access_logs"."granted";