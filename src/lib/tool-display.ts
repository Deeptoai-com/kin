const TOOL_NAME_MAP: Record<string, string> = {
  websearch: 'Web Search',
  web_search: 'Web Search',
  webfetch: 'WebFetch',
  web_fetch: 'WebFetch',
  bash: 'Bash',
  task: 'Task',
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  glob: 'Glob',
  grep: 'Grep',
};

function titleizeSegment(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');
}

function formatToolSegment(raw: string): string {
  if (!raw) return '';
  const normalized = normalizeSegment(raw);
  if (TOOL_NAME_MAP[normalized]) {
    return TOOL_NAME_MAP[normalized];
  }
  return titleizeSegment(normalized || raw);
}

function normalizeSegment(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^\s+|\s+$/g, '')
    .replace(/__/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export function formatToolDisplayName(rawName: string): string {
  if (!rawName) return '';

  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();

  if (TOOL_NAME_MAP[lower]) {
    return TOOL_NAME_MAP[lower];
  }

  if (lower.startsWith('mcp__')) {
    const parts = trimmed.split('__');
    const source = normalizeSegment(parts[1] || '');
    const tool = parts[2] || '';
    const sourceLabel = titleizeSegment(source);
    const toolLabel = formatToolSegment(tool);
    return tool ? `${sourceLabel} · ${toolLabel}` : sourceLabel;
  }

  if (lower.startsWith('mcp_') || lower.startsWith('mcp-')) {
    const source = normalizeSegment(trimmed.replace(/^mcp[_-]+/i, ''));
    return titleizeSegment(source);
  }

  const normalized = normalizeSegment(trimmed);
  return formatToolSegment(normalized || trimmed);
}

export function formatToolNameForSummary(displayName: string): string {
  if (!displayName) return '';
  const [head] = displayName.split('·');
  return head.trim();
}
