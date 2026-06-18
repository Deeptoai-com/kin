/**
 * POST /api/ocr/render — rasterize a PDF to per-page PNGs for the standalone converter
 * (OCR module O2). The browser uploads the PDF; we return page images so the converter
 * can show the original (left pane) AND drive per-page OCR (逐页即显) via /api/ocr.
 *
 * Body: raw PDF bytes (application/pdf). Returns { count, truncated, pages: [{page, image}] }.
 *
 * BUG-008 返工（2026-06-18）：sidecar 默认 10min 太长 —— render 卡时端点跟着挂。下调到 90s
 * （OCR_RENDER_TIMEOUT_MS env 可调），超时返回 504 + 明确文案，前端可在合理时间内 bail。
 */
import { createFileRoute } from '@tanstack/react-router';
import { requireUser } from '~/server/require-user';
import { isRagEnabled } from '~/server/rag/flag';
import { renderPdfViaSidecar } from '~/server/rag/parser-client';

const RENDER_TIMEOUT_MS = Number(process.env.OCR_RENDER_TIMEOUT_MS) || 90_000;

export const Route = createFileRoute('/api/ocr/render')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isRagEnabled()) {
          return Response.json({ error: 'OCR disabled (RAG_ENABLED)' }, { status: 404 });
        }
        await requireUser(request);
        const url = new URL(request.url);
        const dpi = Number(url.searchParams.get('dpi')) || 150;
        const page = Number(url.searchParams.get('page')) || 0; // single-page lazy render (deep pages)
        const bytes = Buffer.from(await request.arrayBuffer());
        if (bytes.length === 0) return Response.json({ error: 'empty body' }, { status: 400 });
        const r = await renderPdfViaSidecar(bytes, {
          dpi,
          page: page > 0 ? page : undefined,
          timeoutMs: RENDER_TIMEOUT_MS,
        });
        if (!r.ok || !r.pages) {
          // 区分超时 vs 真错：超时给 504 让前端能区分"可重试" vs "渲染服务挂了"。
          if (r.error && /aborted|timeout/i.test(r.error)) {
            return Response.json(
              { error: `render timeout after ${RENDER_TIMEOUT_MS}ms — file too complex or sidecar overloaded; try smaller file or retry` },
              { status: 504 },
            );
          }
          return Response.json({ error: r.error || 'render failed' }, { status: 502 });
        }
        return Response.json({ count: r.count, truncated: r.truncated, pages: r.pages });
      },
    },
  },
});
