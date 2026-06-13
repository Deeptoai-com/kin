/**
 * POST /api/ocr/tables — detect table LOCATIONS in a PDF (OCR module table-v3).
 *
 * Parser finds WHERE tables are (page + bbox + rows×cols); it does NOT extract content.
 * The converter flags these pages, overlays the bbox on the page image, and lets the user
 * hand the page(s) to the VLM (/api/ocr) for the actual reading — incl. cross-page tables.
 *
 * Body: raw PDF bytes. → { count, tables: [{ page, bbox, rows, cols }] }.
 */
import { createFileRoute } from '@tanstack/react-router';
import { requireUser } from '~/server/require-user';
import { isRagEnabled } from '~/server/rag/flag';
import { detectTablesViaSidecar } from '~/server/rag/parser-client';

export const Route = createFileRoute('/api/ocr/tables')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isRagEnabled()) {
          return Response.json({ error: 'OCR disabled (RAG_ENABLED)' }, { status: 404 });
        }
        await requireUser(request);
        const bytes = Buffer.from(await request.arrayBuffer());
        if (bytes.length === 0) return Response.json({ error: 'empty body' }, { status: 400 });
        const r = await detectTablesViaSidecar(bytes);
        if (!r.ok) return Response.json({ error: r.error || 'detect failed' }, { status: 502 });
        return Response.json({ count: r.count, tables: r.tables });
      },
    },
  },
});
