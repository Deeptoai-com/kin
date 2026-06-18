/**
 * POST /api/ocr/parse — extract a PDF's TEXT LAYER per page (OCR module O2 v2).
 *
 * The converter parses text PDFs directly (fast/accurate/free) instead of raster+OCR;
 * OCR becomes a per-page, user-triggered fallback. Returns per-page text split on the
 * sidecar's `<!-- odl-page N -->` markers, plus `scanned` (near-empty text layer → the
 * PDF is a scan and needs OCR).
 *
 * Body: raw PDF bytes (application/pdf). → { scanned, pages: [{ page, text }] }.
 *
 * BUG-008 返工（2026-06-18）：sidecar 默认 10min 超时太长 —— parse 卡住时端点要等 10 分钟才
 * bail，前端 `phase='loading'` 期间就一直转。下调到 90s（OCR_PARSE_TIMEOUT_MS env 可调），
 * 超时返回明确 504，前端可在合理时间内呈现"解析失败可重试"。
 */
import { createFileRoute } from '@tanstack/react-router';
import { requireUser } from '~/server/require-user';
import { isRagEnabled } from '~/server/rag/flag';
import { parsePdfViaSidecar } from '~/server/rag/parser-client';

const PARSE_TIMEOUT_MS = Number(process.env.OCR_PARSE_TIMEOUT_MS) || 90_000;

/** Split sidecar markdown into per-page text on the odl-page markers. */
function splitPages(marked: string): { page: number; text: string }[] {
  const re = /<!-- odl-page (\d+) -->/g;
  const out: { page: number; text: string }[] = [];
  let prev: { page: number; start: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(marked)) !== null) {
    if (prev) out.push({ page: prev.page, text: marked.slice(prev.start, m.index).trim() });
    prev = { page: Number(m[1]), start: m.index + m[0].length };
  }
  if (prev) out.push({ page: prev.page, text: marked.slice(prev.start).trim() });
  if (out.length === 0) return [{ page: 1, text: marked.trim() }];
  return out;
}

export const Route = createFileRoute('/api/ocr/parse')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isRagEnabled()) {
          return Response.json({ error: 'OCR disabled (RAG_ENABLED)' }, { status: 404 });
        }
        await requireUser(request);
        const bytes = Buffer.from(await request.arrayBuffer());
        if (bytes.length === 0) return Response.json({ error: 'empty body' }, { status: 400 });

        // BUG-008 返工: sidecar 超时下调到 90s（默认 10min 太长，parse 卡住时整个端点跟着挂）。
        const parsed = await parsePdfViaSidecar(bytes, 'structured', { timeoutMs: PARSE_TIMEOUT_MS });
        if (!parsed.ok || !parsed.markdown?.trim()) {
          // 区分：超时 vs 真无文本层。超时 → 504 + 明确文案；正常无文本层 → 视为扫描件。
          if (parsed.error && /aborted|timeout/i.test(parsed.error)) {
            return Response.json(
              { error: `parse timeout after ${PARSE_TIMEOUT_MS}ms — file too complex or sidecar overloaded; try smaller file or retry` },
              { status: 504 },
            );
          }
          if (parsed.error) {
            return Response.json({ error: `parse failed: ${parsed.error}` }, { status: 502 });
          }
          // No text layer → scanned PDF; converter falls back to per-page OCR.
          return Response.json({ scanned: true, pages: [] });
        }
        const pages = splitPages(parsed.markdown);
        const totalChars = pages.reduce((n, p) => n + p.text.replace(/\s+/g, '').length, 0);
        const scanned = pages.length > 0 && totalChars / pages.length < 30;
        return Response.json({ scanned, pages });
      },
    },
  },
});
