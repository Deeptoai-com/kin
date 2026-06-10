import { Repository } from "drizzle-repository-generator";
import { db } from "../client";
import { documentChunks, documents } from "../schema";

export const documentRepo = Repository(db, documents);
export const documentChunkRepo = Repository(db, documentChunks);

/**
 * Hook for the worker's `reindex-all` job (src/worker/processors/reindexDocuments.ts
 * dynamically imports this module and looks for exactly this export). Until RAG R1
 * added it, the job soft-no-op'd with "No repository hook found" (audit errata, D8).
 */
export async function getAllDocumentsForSearch() {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      fileName: documents.filename,
    })
    .from(documents);
}

export default documentRepo;