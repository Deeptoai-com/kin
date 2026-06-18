/**
 * Shared upload size limits + helpers (上传链路根治 PRD §3.2).
 *
 * One source of truth for BOTH entry points so they behave consistently
 * (acceptance: "两个入口一致受益"):
 *  - the chat composer (attach-to-chat, workspace files route)
 *  - the Documents page (RAG/KB ingest, S3/MinIO direct upload)
 *
 * Plain module (no server-only imports) so the route handler AND the browser
 * components can both import it. The browser uses these constants as the FIRST
 * gate (reject before any bytes leave the page); the server route re-checks
 * `Content-Length` as a backstop.
 */

const MB = 1024 * 1024;

/**
 * Max size for a file attached to a chat message (composer → workspace).
 * Rich docs over the inline-parse cap (25MB) won't get a text version anyway,
 * and the chat path is not the bulk-ingest path — big files belong in the KB.
 */
export const CHAT_ATTACH_MAX_BYTES = 50 * MB;

/**
 * Max size for a Documents-page (RAG/KB) upload. Larger than chat attach since
 * this is the bulk-ingest tier, but still bounded so a 200MB direct-to-MinIO
 * upload fails fast with a clear "超限" instead of stalling at 1% (BUG-006).
 */
export const DOC_UPLOAD_MAX_BYTES = 100 * MB;

/** Human-readable bytes, e.g. 52428800 → "50 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  const decimals = value >= 10 || power === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[power]}`;
}

/**
 * Clear, user-facing over-limit message. `kind` tailors the escape hatch:
 * the chat path points users at the knowledge base for big files.
 */
export function tooLargeMessage(maxBytes: number, kind: 'chat' | 'doc' = 'chat'): string {
  const cap = formatBytes(maxBytes);
  return kind === 'chat'
    ? `文件超过 ${cap} 上限，大文件请用「知识库」批量入库。`
    : `文件超过 ${cap} 上限，请压缩或拆分后再上传。`;
}

/** True if the file is within the limit (i.e. allowed to upload). */
export function isWithinLimit(sizeBytes: number, maxBytes: number): boolean {
  return sizeBytes <= maxBytes;
}
