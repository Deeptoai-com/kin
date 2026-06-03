/**
 * skills-api client (server-only)
 *
 * Thin client for the upstream skills-api registry (Hono service, ~9,600
 * scraped GitHub skills). Used to fetch SKILL.md content on demand for catalog
 * entries that reference an upstream skill. Public reads need no key; the
 * optional SKILLS_API_KEY only gates /api/admin/*.
 *
 * Config:
 *   SKILLS_API_URL  — base URL (default: https://skills-api.deeptoai.com)
 *   SKILLS_API_KEY  — optional x-api-key (not needed for content reads)
 *
 * See docs/project/prd/2026-06-skills-integration-prd.md (§1, §8, S1b).
 */

import type { SkillUpstreamRef } from '~/db/schema/skill-catalog.schema';

const DEFAULT_SKILLS_API_URL = 'https://skills-api.deeptoai.com';
const REQUEST_TIMEOUT_MS = 15_000;

/** Resolve the skills-api base URL (trailing slashes trimmed). */
export function getSkillsApiBaseUrl(): string {
  const raw = process.env.SKILLS_API_URL?.trim() || DEFAULT_SKILLS_API_URL;
  return raw.replace(/\/+$/, '');
}

/** Response shape of GET /api/skills/:owner/:repo/:skillId/content */
export interface SkillsApiContent {
  source: string;
  skillId: string;
  path: string;
  // Frontmatter parsed from SKILL.md (name/description/…)
  metadata: Record<string, unknown> | null;
  // SKILL.md body (frontmatter stripped)
  instructions: string | null;
  // Full raw SKILL.md (frontmatter + body)
  raw: string | null;
}

/** One row from GET /api/skills (lean list — no description/content). */
export interface SkillsApiListItem {
  source: string;
  owner: string;
  repo: string;
  skillId: string;
  name: string;
  displayName: string;
  installs: number;
  isOfficial: boolean;
  githubUrl: string;
}

export interface SkillsApiSearchResult {
  skills: SkillsApiListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Search the upstream skills registry.
 * GET /api/skills?query=&owner=&repo=&sortBy=&sortOrder=&page=&pageSize=
 */
export async function searchSkills(params: {
  query?: string;
  owner?: string;
  repo?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}): Promise<SkillsApiSearchResult> {
  const base = getSkillsApiBaseUrl();
  const qs = new URLSearchParams();
  if (params.query) qs.set('query', params.query);
  if (params.owner) qs.set('owner', params.owner);
  if (params.repo) qs.set('repo', params.repo);
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
  qs.set('page', String(params.page ?? 1));
  qs.set('pageSize', String(params.pageSize ?? 20));

  const res = await fetch(`${base}/api/skills?${qs.toString()}`, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`skills-api search failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as SkillsApiSearchResult;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const key = process.env.SKILLS_API_KEY?.trim();
  if (key) headers['x-api-key'] = key;
  return headers;
}

/**
 * Fetch the full SKILL.md content for an upstream skill reference.
 * Throws on network error / non-2xx so callers can surface a clear status.
 */
export async function fetchSkillContent(
  ref: SkillUpstreamRef,
  opts?: { branch?: string },
): Promise<SkillsApiContent> {
  const base = getSkillsApiBaseUrl();
  const { owner, repo, skillId } = ref;
  const path = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(skillId)}`;
  const query = opts?.branch ? `?branch=${encodeURIComponent(opts.branch)}` : '';
  const url = `${base}/api/skills/${path}/content${query}`;

  const res = await fetch(url, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`skills-api content fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }

  return (await res.json()) as SkillsApiContent;
}

/**
 * Split a raw SKILL.md into frontmatter (simple key: value) + body.
 * Used so cache-hits (which only store the raw text) render the same way as
 * fresh fetches. Not a full YAML parser — SKILL.md frontmatter is flat.
 */
export function parseSkillMarkdown(raw: string | null | undefined): {
  metadata: Record<string, string>;
  body: string;
} {
  if (!raw) return { metadata: {}, body: '' };
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { metadata: {}, body: raw };
  const metadata: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      metadata[line.slice(0, idx).trim()] = line
        .slice(idx + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
    }
  }
  return { metadata, body: match[2] };
}
