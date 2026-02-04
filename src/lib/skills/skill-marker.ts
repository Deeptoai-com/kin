export type SkillMarker = {
  slug: string;
  name?: string;
};

const MARKER_PREFIX = '[[skill:';
const MARKER_SUFFIX = ']]';
const MARKER_REGEX = /^\[\[skill:([^\]|]+)(?:\|([^\]]+))?\]\]$/;

function safeDecode(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildSkillMarker(slug: string, name?: string): string {
  const encodedName = name ? encodeURIComponent(name) : '';
  return `${MARKER_PREFIX}${slug}${encodedName ? `|${encodedName}` : ''}${MARKER_SUFFIX}`;
}

export function parseSkillMarker(text: string): { marker?: SkillMarker; strippedText: string } {
  const lines = text.split('\n');
  if (lines.length === 0) {
    return { strippedText: text };
  }

  const firstLine = lines[0]?.trim();
  if (!firstLine || !firstLine.startsWith(MARKER_PREFIX)) {
    return { strippedText: text };
  }

  const match = firstLine.match(MARKER_REGEX);
  if (!match) {
    return { strippedText: text };
  }

  const slug = match[1];
  const name = safeDecode(match[2]);
  const strippedText = lines.slice(1).join('\n').replace(/^\s+/, '');
  return {
    marker: { slug, name },
    strippedText,
  };
}

export function injectSkillMarker(text: string, marker: string): string {
  const { marker: existing } = parseSkillMarker(text);
  if (existing) return text;
  if (!text.trim()) return marker;
  return `${marker}\n${text}`;
}
