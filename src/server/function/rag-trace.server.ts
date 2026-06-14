/**
 * Retrieval workbench tab (RAG observability) — read the current session's kb_search traces.
 *
 * rag_search_trace stores one row per kb_search with the FUNNEL as chunk-id lists per stage
 * (vector / bm25 / fused / reranked / returned). This fn resolves those ids back to
 * text·section·page (joining document_chunks + documents) so the panel can show "what each
 * recall leg found, what rerank changed, what was finally surfaced" — letting a human tell a
 * RECALL miss (the right chunk never appears) from a RANKING miss (it appears but is dropped).
 *
 * Scoped to the caller's own traces AND the given session (= client currentSessionId). Read-only.
 */
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '~/db/db-config';
import { ragSearchTrace } from '~/db/schema/rag-trace.schema';
import { documentChunks, documents } from '~/db/schema/document.schema';
import { auth } from '~/server/auth.server';
import { isRagEnabled } from '~/server/rag/flag';

const SNIPPET_MAX = 240;
const TRACE_LIMIT = 30;

const requireUser = async () => {
  const { headers } = getRequest();
  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new Error('UNAUTHORIZED');
  return session.user;
};

const normalize = <T>(input: unknown, schema: z.ZodType<T>): T => {
  const data = input && typeof input === 'object' && 'data' in (input as object) ? (input as { data: unknown }).data : input;
  return schema.parse(data);
};

/** One resolved candidate chunk (id → human-readable provenance). */
export interface RagTraceChunk {
  docTitle: string;
  sectionPath: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  snippet: string;
}

/** One kb_search execution's funnel (ids per stage + meta). */
export interface RagTraceView {
  id: string;
  query: string;
  createdAt: string;
  visibleDocCount: number | null;
  degraded: string | null;
  latencyMs: number | null;
  k: number | null;
  /** rerank actually ran this search (rerankedIds present). */
  reranked: boolean;
  vectorIds: string[];
  bm25Ids: string[];
  fusedIds: string[];
  rerankedIds: string[] | null;
  returnedIds: string[];
}

export interface SessionRagTraces {
  traces: RagTraceView[];
  /** Shared chunk metadata, keyed by chunk id (ids missing here = chunk purged / re-ingested). */
  chunks: Record<string, RagTraceChunk>;
}

const asIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** Recent kb_search traces for the current session, with chunk ids resolved to text·section·page. */
export const listSessionRagTraces = createServerFn({ method: 'GET' })
  .inputValidator((input) => normalize(input, z.object({ sessionId: z.string().min(1) })))
  .handler(async ({ data }): Promise<SessionRagTraces> => {
    const user = await requireUser();
    if (!isRagEnabled()) return { traces: [], chunks: {} };

    const rows = await db
      .select()
      .from(ragSearchTrace)
      .where(and(eq(ragSearchTrace.userId, user.id), eq(ragSearchTrace.sessionId, data.sessionId)))
      .orderBy(desc(ragSearchTrace.createdAt))
      .limit(TRACE_LIMIT);
    if (rows.length === 0) return { traces: [], chunks: {} };

    const traces: RagTraceView[] = rows.map((r) => {
      const params = (r.params ?? {}) as { k?: number };
      const rerankedIds = r.rerankedIds == null ? null : asIds(r.rerankedIds);
      return {
        id: r.id,
        query: r.query,
        createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt as string)).toISOString(),
        visibleDocCount: r.visibleDocCount ?? null,
        degraded: r.degraded ?? null,
        latencyMs: r.latencyMs ?? null,
        k: typeof params.k === 'number' ? params.k : null,
        reranked: rerankedIds != null,
        vectorIds: asIds(r.vectorIds),
        bm25Ids: asIds(r.bm25Ids),
        fusedIds: asIds(r.fusedIds),
        rerankedIds,
        returnedIds: asIds(r.returnedIds),
      };
    });

    // Resolve every referenced chunk id once (union across all stages of all traces).
    const ids = new Set<string>();
    for (const t of traces) {
      for (const id of [...t.vectorIds, ...t.bm25Ids, ...t.fusedIds, ...(t.rerankedIds ?? []), ...t.returnedIds]) ids.add(id);
    }
    const chunks: Record<string, RagTraceChunk> = {};
    if (ids.size > 0) {
      const chunkRows = await db
        .select({
          id: documentChunks.id,
          documentId: documentChunks.documentId,
          sectionPath: documentChunks.sectionPath,
          pageStart: documentChunks.pageStart,
          pageEnd: documentChunks.pageEnd,
          text: documentChunks.text,
        })
        .from(documentChunks)
        .where(inArray(documentChunks.id, [...ids]));
      const docIds = [...new Set(chunkRows.map((c) => c.documentId).filter((d): d is string => !!d))];
      const titles = new Map(
        docIds.length
          ? (await db.select({ id: documents.id, title: documents.title }).from(documents).where(inArray(documents.id, docIds))).map((d) => [d.id, d.title])
          : [],
      );
      for (const c of chunkRows) {
        const text = c.text ?? '';
        chunks[c.id] = {
          docTitle: (c.documentId && titles.get(c.documentId)) || '（未知文档）',
          sectionPath: c.sectionPath,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          snippet: text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX)}…` : text,
        };
      }
    }
    return { traces, chunks };
  });
