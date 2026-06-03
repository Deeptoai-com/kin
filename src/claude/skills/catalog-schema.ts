/**
 * Catalog skill fillable-variable schema (server-only).
 *
 * Generates the composer form schema from a catalog skill's SKILL.md and caches
 * it in skill_schema_cache, keyed by (catalogId, contentHash). Lazy/on-demand:
 * generation runs only when explicitly requested (it costs an SDK/LLM call), and
 * the cache is GLOBAL per (catalogId, contentHash) — generate once, every user
 * benefits. Stale detection compares the cached hash against the current content.
 *
 * Reuses the (fixed) generateSchemaFromContent core — an independent SDK call
 * chain, decoupled from the filesystem. See PRD D5 / S2.2.
 */

import {
  generateSchemaFromContent,
  SCHEMA_GENERATOR_VERSION,
  type SkillSchema,
} from './schema-generator';
import { getCatalogSkillContent } from './catalog-content';
import type { SkillUpstreamRef } from '~/db/schema/skill-catalog.schema';

export type CatalogSchemaStatus = 'missing' | 'valid' | 'stale' | 'failed' | 'needs_review';

export interface CatalogSchemaResult {
  status: CatalogSchemaStatus;
  schema: SkillSchema | null;
  contentHash: string | null;
  generatedAt: string | null;
  lastError: string | null;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Read the cached schema for a catalog skill (no generation).
 * Marks the row 'stale' if the current content hash differs from the one the
 * schema was generated from.
 */
export async function readCatalogSchema(catalogId: string): Promise<CatalogSchemaResult> {
  const { db } = await import('~/db/db-config');
  const { skillSchemaCache, skillContentCache } = await import('~/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const [schemaRow] = await db
    .select()
    .from(skillSchemaCache)
    .where(eq(skillSchemaCache.catalogId, catalogId))
    .orderBy(desc(skillSchemaCache.generatedAt))
    .limit(1);

  if (!schemaRow) {
    return { status: 'missing', schema: null, contentHash: null, generatedAt: null, lastError: null };
  }

  const [contentRow] = await db
    .select({ hash: skillContentCache.contentHash })
    .from(skillContentCache)
    .where(eq(skillContentCache.catalogId, catalogId))
    .limit(1);

  let status = schemaRow.status as CatalogSchemaStatus;
  if (
    (status === 'valid' || status === 'needs_review') &&
    contentRow?.hash &&
    schemaRow.contentHash &&
    contentRow.hash !== schemaRow.contentHash
  ) {
    status = 'stale';
  }

  return {
    status,
    schema: (schemaRow.schema as SkillSchema | null) ?? null,
    contentHash: schemaRow.contentHash,
    generatedAt: toIso(schemaRow.generatedAt),
    lastError: schemaRow.lastError ?? null,
  };
}

/**
 * Generate (or return cached) the fillable-variable schema for a catalog skill.
 * Resolves SKILL.md (cache-first), runs the generator, and upserts the result
 * keyed by content hash. Failures are recorded as status='failed' (non-throwing).
 */
export async function generateCatalogSchema(
  catalog: { id: string; upstream: SkillUpstreamRef | null },
  opts?: { force?: boolean },
): Promise<CatalogSchemaResult> {
  const { db } = await import('~/db/db-config');
  const { skillSchemaCache } = await import('~/db/schema');
  const { and, eq } = await import('drizzle-orm');

  const content = await getCatalogSkillContent(catalog);
  if (!content.skillMd || !content.contentHash) {
    return {
      status: 'missing',
      schema: null,
      contentHash: null,
      generatedAt: null,
      lastError: content.error ?? 'no SKILL.md content',
    };
  }
  const hash = content.contentHash;

  if (!opts?.force) {
    const [existing] = await db
      .select()
      .from(skillSchemaCache)
      .where(and(eq(skillSchemaCache.catalogId, catalog.id), eq(skillSchemaCache.contentHash, hash)))
      .limit(1);
    if (existing && (existing.status === 'valid' || existing.status === 'needs_review') && existing.schema) {
      return {
        status: existing.status as CatalogSchemaStatus,
        schema: existing.schema as SkillSchema,
        contentHash: hash,
        generatedAt: toIso(existing.generatedAt),
        lastError: null,
      };
    }
  }

  const now = new Date();
  try {
    const result = await generateSchemaFromContent(content.skillMd);
    const status: CatalogSchemaStatus = result.needsReview ? 'needs_review' : 'valid';
    await db
      .insert(skillSchemaCache)
      .values({
        catalogId: catalog.id,
        contentHash: hash,
        schema: result.schema,
        status,
        generatorVersion: SCHEMA_GENERATOR_VERSION,
        generatedAt: now,
        lastError: result.errorMessage ?? null,
      })
      .onConflictDoUpdate({
        target: [skillSchemaCache.catalogId, skillSchemaCache.contentHash],
        set: {
          schema: result.schema,
          status,
          generatorVersion: SCHEMA_GENERATOR_VERSION,
          generatedAt: now,
          lastError: result.errorMessage ?? null,
        },
      });
    return { status, schema: result.schema, contentHash: hash, generatedAt: now.toISOString(), lastError: result.errorMessage ?? null };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'schema generation failed';
    await db
      .insert(skillSchemaCache)
      .values({
        catalogId: catalog.id,
        contentHash: hash,
        schema: null,
        status: 'failed',
        generatorVersion: SCHEMA_GENERATOR_VERSION,
        generatedAt: now,
        lastError: msg,
      })
      .onConflictDoUpdate({
        target: [skillSchemaCache.catalogId, skillSchemaCache.contentHash],
        set: { status: 'failed', generatedAt: now, lastError: msg },
      });
    return { status: 'failed', schema: null, contentHash: hash, generatedAt: now.toISOString(), lastError: msg };
  }
}
