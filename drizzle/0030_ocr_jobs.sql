CREATE TABLE "ocr_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_id" text,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"page_count" integer DEFAULT 0 NOT NULL,
	"scanned" boolean DEFAULT false NOT NULL,
	"pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ocr_jobs_user" ON "ocr_jobs" USING btree ("user_id");