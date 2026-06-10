/**
 * Structure-aware Markdown chunker (final spec D10) — pure, unit-tested.
 *
 * Parents = heading-delimited sections (small-to-big retrieval returns these).
 * Children = paragraph-packed slices of a parent, ≤ CHILD_MAX_TOKENS each (safety margin
 * under Zhipu's 3072-token per-text hard limit).
 * Every chunk carries its `sectionPath` ("§ 标题 > 子标题") for citations and for the
 * free-tier contextual prefix (final spec D9).
 */
import { estimateTokens } from './tier';

export const CHILD_MAX_TOKENS = 1_024;
export const PARENT_MAX_TOKENS = 2_500;

export interface ParentChunk {
  sectionPath: string;
  text: string;
}

export interface ChildChunk {
  /** Index into the parents array (resolved to parentChunkId at insert time). */
  parentIndex: number;
  sectionPath: string;
  text: string;
}

export interface TocEntry {
  path: string;
  level: number;
}

export interface ChunkResult {
  parents: ParentChunk[];
  children: ChildChunk[];
  toc: TocEntry[];
}

interface Section {
  path: string[];
  level: number;
  lines: string[];
}

/** Split markdown into heading-scoped sections; preamble before any heading keeps the doc title. */
function splitSections(markdown: string, docTitle: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { path: [docTitle], level: 0, lines: [] };
  const stack: Array<{ level: number; title: string }> = [];

  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) {
      if (current.lines.some((l) => l.trim() !== '')) sections.push(current);
      const level = m[1].length;
      const title = m[2].trim();
      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title });
      current = { path: [docTitle, ...stack.map((s) => s.title)], level, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.some((l) => l.trim() !== '')) sections.push(current);
  return sections;
}

/** Pack paragraphs into pieces of ≤ maxTokens, hard-splitting any oversized paragraph. */
function packParagraphs(text: string, maxTokens: number): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pieces: string[] = [];
  let buf = '';

  const flush = () => {
    if (buf.trim()) pieces.push(buf.trim());
    buf = '';
  };

  for (let p of paragraphs) {
    // A single paragraph beyond the limit (e.g. a giant table) gets hard-split by lines.
    if (estimateTokens(p) > maxTokens) {
      flush();
      let part = '';
      for (const line of p.split('\n')) {
        if (estimateTokens(part) + estimateTokens(line) > maxTokens && part) {
          pieces.push(part.trim());
          part = '';
        }
        part += line + '\n';
      }
      if (part.trim()) pieces.push(part.trim());
      continue;
    }
    if (buf && estimateTokens(buf) + estimateTokens(p) > maxTokens) flush();
    buf += (buf ? '\n\n' : '') + p;
  }
  flush();
  return pieces;
}

/**
 * Chunk a markdown document. `docTitle` roots every sectionPath (it is also the
 * context prefix root, so "费率为4.5%" embeds as "合同X > §3 退款政策\n费率为4.5%").
 */
export function chunkMarkdown(docTitle: string, markdown: string): ChunkResult {
  const sections = splitSections(markdown, docTitle);
  const parents: ParentChunk[] = [];
  const children: ChildChunk[] = [];
  const toc: TocEntry[] = [];

  for (const section of sections) {
    const body = section.lines.join('\n').trim();
    if (!body) continue;
    const sectionPath = section.path.join(' > ');
    if (section.level > 0) toc.push({ path: sectionPath, level: section.level });

    // Parent = the section, capped so small-to-big expansion stays context-friendly.
    for (const parentText of packParagraphs(body, PARENT_MAX_TOKENS)) {
      const parentIndex = parents.length;
      parents.push({ sectionPath, text: parentText });
      for (const childText of packParagraphs(parentText, CHILD_MAX_TOKENS)) {
        children.push({ parentIndex, sectionPath, text: childText });
      }
    }
  }
  return { parents, children, toc };
}
