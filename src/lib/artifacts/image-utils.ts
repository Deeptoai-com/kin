const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico'] as const;
const IMAGE_EXT_REGEX = new RegExp(`(${IMAGE_EXTENSIONS.map((ext) => ext.replace('.', '\\.') ).join('|')})$`, 'i');
const IMAGE_PATH_REGEX = /[\w@%+=:,./-]+\.(?:png|jpe?g|gif|webp|bmp|ico)/gi;

function normalizeImagePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('./')) {
    return trimmed.slice(2);
  }
  return trimmed;
}

export function isImageFilePath(value: string): boolean {
  if (!value) return false;
  const normalized = value.trim();
  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('data:')) {
    return false;
  }
  const cleaned = normalized.split('?')[0]?.split('#')[0] ?? normalized;
  return IMAGE_EXT_REGEX.test(cleaned.toLowerCase());
}

function collectImagePathsFromValue(value: unknown, paths: Set<string>): void {
  if (typeof value === 'string') {
    const normalized = normalizeImagePath(value);
    if (isImageFilePath(normalized)) {
      paths.add(normalized);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectImagePathsFromValue(item, paths);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    collectImagePathsFromValue(record[key], paths);
  }
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function collectFromString(text: string, paths: Set<string>): void {
  const parsed = tryParseJson(text);
  if (parsed !== null) {
    collectImagePathsFromValue(parsed, paths);
    return;
  }
  const matches = text.match(IMAGE_PATH_REGEX) || [];
  for (const match of matches) {
    const normalized = normalizeImagePath(match);
    if (isImageFilePath(normalized)) {
      paths.add(normalized);
    }
  }
}

export function extractImagePathsFromResult(result: unknown): string[] {
  const paths = new Set<string>();
  if (typeof result === 'string') {
    collectFromString(result, paths);
  } else {
    collectImagePathsFromValue(result, paths);
  }
  return Array.from(paths);
}

export function extractImagePathsFromArgs(args?: Record<string, unknown>): string[] {
  if (!args) return [];
  const paths = new Set<string>();
  const candidateKeys = [
    'imagePath',
    'file_path',
    'filePath',
    'path',
    'output',
    'outputs',
    'filesCreated',
    'savedImage',
    'file',
    'files',
    'images',
  ];
  for (const key of candidateKeys) {
    if (key in args) {
      collectImagePathsFromValue(args[key], paths);
    }
  }
  return Array.from(paths);
}

export function extractImagePaths(args: Record<string, unknown> | undefined, result: unknown): string[] {
  const paths = new Set<string>();
  for (const path of extractImagePathsFromResult(result)) {
    paths.add(path);
  }
  for (const path of extractImagePathsFromArgs(args)) {
    paths.add(path);
  }
  return Array.from(paths);
}
