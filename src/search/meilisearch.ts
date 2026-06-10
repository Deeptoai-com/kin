import { MeiliSearch } from 'meilisearch'

const host = process.env.MEILI_HOST ?? 'http://localhost:7700'
const apiKey = process.env.MEILI_API_KEY ?? process.env.MEILI_MASTER_KEY

export const meili = new MeiliSearch({
  host,
  apiKey,
})

export type SearchDoc = {
  id: string
  title?: string
  content?: string
  fileName?: string
  symbols?: string[]
  headings?: string[]
}

export async function ensureIndexes() {
  try {
    await meili.createIndex('documents', { primaryKey: 'id' })
  } catch {
    // index likely exists
  }
  // RAG R1 (final spec D7/D8): chunk-level BM25 index — the keyword leg of kb_search's
  // hybrid retrieval. documentId is filterable so deletion and access scoping can filter.
  try {
    await meili.createIndex(CHUNKS_INDEX, { primaryKey: 'id' })
  } catch {
    // index likely exists
  }
  try {
    await meili.index(CHUNKS_INDEX).updateFilterableAttributes(['documentId'])
  } catch {
    // best-effort: settings update failing must not block boot
  }
}

export async function indexDocuments(docs: SearchDoc[]) {
  const index = meili.index<SearchDoc>('documents')
  await index.addDocuments(docs)
}

// ── RAG chunks (final spec D7: BM25 leg of hybrid retrieval) ──────────────────

export const CHUNKS_INDEX = 'document_chunks'

export type SearchChunk = {
  /** documentChunks.id — joins BM25 hits back to pgvector rows for RRF fusion. */
  id: string
  documentId: string
  sectionPath?: string | null
  text: string
}

export async function indexChunks(chunks: SearchChunk[]) {
  if (chunks.length === 0) return
  await ensureIndexes()
  await meili.index<SearchChunk>(CHUNKS_INDEX).addDocuments(chunks)
}

export async function removeChunksOfDocument(documentId: string) {
  try {
    await meili.index(CHUNKS_INDEX).deleteDocuments({ filter: `documentId = "${documentId}"` })
  } catch {
    // index may not exist yet — nothing to remove
  }
}

/** BM25 search over chunks, scoped to the given (already access-filtered) document ids. */
export async function searchChunks(query: string, documentIds: string[], limit = 20) {
  if (documentIds.length === 0) return []
  const filter = `documentId IN [${documentIds.map((id) => `"${id}"`).join(', ')}]`
  const res = await meili.index<SearchChunk>(CHUNKS_INDEX).search(query, { filter, limit })
  return res.hits
}