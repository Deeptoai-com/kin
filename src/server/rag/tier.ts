/**
 * RAG tier routing (final spec D5) — pure, unit-tested.
 *
 * The whole point of tiering: most uploads are small and must NOT be embedded
 * (workspace Read/Grep already serves them better and for free). Only 'rag'-tier
 * documents enter the chunk+embed pipeline.
 */

export type RagTier = 'inline' | 'grep' | 'rag';

/** inline-tier ceiling: comfortably fits a context window slice. */
export const INLINE_MAX_TOKENS = 8_000;
/** rag-tier floor (default; override via RAG_TIER_RAG_MIN_TOKENS). */
export const DEFAULT_RAG_MIN_TOKENS = 20_000;

/**
 * Cheap token estimate good enough for routing (NOT for billing): CJK chars count
 * ~1 token each; everything else ~4 chars/token.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    // CJK unified + extensions, kana, hangul — the ranges that tokenize ~1:1.
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af)
    ) {
      cjk++;
    } else {
      other++;
    }
  }
  return cjk + Math.ceil(other / 4);
}

export function ragMinTokens(): number {
  const raw = Number(process.env.RAG_TIER_RAG_MIN_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RAG_MIN_TOKENS;
}

/** Route a document by its estimated tokens. */
export function routeTier(tokenEstimate: number, ragMin: number = ragMinTokens()): RagTier {
  if (tokenEstimate >= ragMin) return 'rag';
  if (tokenEstimate > INLINE_MAX_TOKENS) return 'grep';
  return 'inline';
}
