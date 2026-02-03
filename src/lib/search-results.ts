export type SearchSource = {
  title: string;
  url?: string;
  domain?: string;
  snippet?: string;
};

const LINK_PATTERN = /Links: (\[[\s\S]*?\])(?=\n|$)/g;

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function extractSourcesFromArray(items: unknown[]): SearchSource[] {
  const sources: SearchSource[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const title = (record.title || record.name || record.heading || record.text) as string | undefined;
    const url = (record.url || record.link || record.href) as string | undefined;
    const snippet = (record.snippet || record.description || record.summary || record.content) as string | undefined;
    if (title || url || snippet) {
      sources.push({
        title: title || url || 'Untitled',
        url,
        domain: extractDomain(url),
        snippet,
      });
    }
  }
  return sources;
}

function extractSourcesFromObject(obj: Record<string, unknown>): SearchSource[] {
  const candidateKeys = ['results', 'data', 'items', 'sources', 'links', 'entries'];
  for (const key of candidateKeys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return extractSourcesFromArray(value);
    }
  }
  if (Array.isArray(obj.links)) {
    return extractSourcesFromArray(obj.links as unknown[]);
  }
  return [];
}

function parseLinksFromText(text: string): SearchSource[] {
  const sources: SearchSource[] = [];
  const matches = text.matchAll(LINK_PATTERN);
  for (const match of matches) {
    const jsonArray = match[1];
    const parsed = tryParseJson(jsonArray);
    if (Array.isArray(parsed)) {
      sources.push(...extractSourcesFromArray(parsed));
    }
  }
  return sources;
}

export function parseSearchResult(raw: unknown): { sources: SearchSource[]; rawText: string } {
  const text = typeof raw === 'string' ? raw : raw ? JSON.stringify(raw, null, 2) : '';
  const trimmed = text.trim();

  let sources = parseLinksFromText(text);

  if (sources.length === 0 && trimmed) {
    const parsed = tryParseJson(trimmed);
    if (Array.isArray(parsed)) {
      sources = extractSourcesFromArray(parsed);
    } else if (parsed && typeof parsed === 'object') {
      sources = extractSourcesFromObject(parsed as Record<string, unknown>);
    }
  }

  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  const rawText = looksLikeJson
    ? ''
    : text.replace(LINK_PATTERN, '').trim();

  return {
    sources,
    rawText,
  };
}
