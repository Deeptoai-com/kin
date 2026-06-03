/**
 * Catalog skill content resolver (server-only).
 *
 * Cache-first SKILL.md resolution for a catalog row: returns the cached content
 * from skill_content_cache, else fetches from skills-api and upserts the cache.
 * Shared by the detail server function (display) and the materializer (S2 install).
 *
 * See docs/project/prd/2026-06-skills-integration-prd.md (S1b/S2).
 */

import { fetchSkillContent, parseSkillMarkdown } from './skills-api-client';
import { hashSkillMd } from './schema-generator';
import type { SkillUpstreamRef } from '~/db/schema/skill-catalog.schema';

export type CatalogContentStatus = 'cached' | 'fetched' | 'no_upstream' | 'unavailable';

export interface ResolvedSkillContent {
  skillMd: string | null;
  instructions: string | null;
  metadata: Record<string, string> | null;
  contentHash: string | null;
  status: CatalogContentStatus;
  error: string | null;
}

function render(
  raw: string | null,
  contentHash: string | null,
  status: CatalogContentStatus,
  error: string | null,
): ResolvedSkillContent {
  const { metadata, body } = parseSkillMarkdown(raw);
  return {
    skillMd: raw,
    instructions: raw ? body : null,
    metadata: raw ? metadata : null,
    contentHash,
    status,
    error,
  };
}

/**
 * Resolve a catalog skill's SKILL.md, cache-first.
 *
 * @param catalog  the catalog row id + upstream ref
 * @param opts.force  bypass the cache and refetch
 */
export async function getCatalogSkillContent(
  catalog: { id: string; upstream: SkillUpstreamRef | null },
  opts?: { force?: boolean },
): Promise<ResolvedSkillContent> {
  const { db } = await import('~/db/db-config');
  const { skillContentCache } = await import('~/db/schema');
  const { eq } = await import('drizzle-orm');

  const readCache = async () => {
    const [row] = await db
      .select()
      .from(skillContentCache)
      .where(eq(skillContentCache.catalogId, catalog.id))
      .limit(1);
    return row ?? null;
  };

  if (!opts?.force) {
    const cached = await readCache();
    if (cached?.skillMd) {
      return render(cached.skillMd, cached.contentHash, 'cached', null);
    }
  }

  if (!catalog.upstream) {
    return render(null, null, 'no_upstream', null);
  }

  try {
    const content = await fetchSkillContent(catalog.upstream);
    const raw = content.raw ?? null;
    if (!raw) {
      return render(null, null, 'unavailable', 'skills-api returned empty content');
    }
    const contentHash = hashSkillMd(raw);
    const now = new Date();
    await db
      .insert(skillContentCache)
      .values({ catalogId: catalog.id, skillMd: raw, contentHash, fetchedAt: now })
      .onConflictDoUpdate({
        target: skillContentCache.catalogId,
        set: { skillMd: raw, contentHash, fetchedAt: now },
      });
    return render(raw, contentHash, 'fetched', null);
  } catch (error) {
    // Fall back to any stale cache even on force
    const cached = await readCache();
    if (cached?.skillMd) {
      return render(cached.skillMd, cached.contentHash, 'cached', null);
    }
    return render(
      null,
      null,
      'unavailable',
      error instanceof Error ? error.message : 'content fetch failed',
    );
  }
}
