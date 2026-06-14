ALTER TABLE "rag_search_trace" ADD COLUMN "session_id" text;--> statement-breakpoint
CREATE INDEX "idx_rag_search_trace_session" ON "rag_search_trace" USING btree ("session_id");