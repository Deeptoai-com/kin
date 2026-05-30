-- P2-1: per-run usage record (observation-only; does NOT charge credits).
-- One row per model used in a run; rows of the same run share run_id.
--
-- NOTE: drizzle's generate also wanted to (re)create "message_attachment" and
-- "profile" because those tables were introduced via hand-written SQL outside
-- drizzle's journal (e.g. 0018_helpful_red_skull.sql), so the 0017 snapshot did
-- not know them. The accompanying snapshot (meta/0018_snapshot.json) now records
-- all of them, which reconciles that drift for future `db:generate`. We
-- intentionally keep only the usage_record DDL here so `db:migrate` does not try
-- to recreate the already-existing tables.
CREATE TABLE "usage_record" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"run_id" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"num_turns" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(14, 6) DEFAULT '0' NOT NULL,
	"is_error" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_record" ADD CONSTRAINT "usage_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_record_user_id_idx" ON "usage_record" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_record_run_id_idx" ON "usage_record" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "usage_record_created_at_idx" ON "usage_record" USING btree ("created_at");
