/**
 * Async-parse status sidecar (上传链路根治 PRD §3.1).
 *
 * The upload route writes a file to the workspace and returns immediately; the
 * markdown parse runs in the background. We persist the parse status to a small
 * JSON sidecar under a hidden `.uploads-status/` dir so:
 *  - the GET parse-status route can report progress to the composer chip, and
 *  - status survives the request lifecycle (the parse is not tied to the POST).
 *
 * The dir is `.`-prefixed, so it's filtered out of workspace listings + Glob
 * (mirrors the `.uploads/` stash for the original binary).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ParseStatusValue = 'parsing' | 'parsed' | 'scanned' | 'failed';

export interface ParseStatusRecord {
  status: ParseStatusValue;
  /** epoch ms when parsing began — used to age out a stuck `parsing` (process restart). */
  startedAt: number;
  updatedAt: number;
  /** workspace-relative `.md` the Agent should Read (parsed/scanned only). */
  parsedPath?: string;
  engine?: string;
  error?: string;
}

const STATUS_DIR = '.uploads-status';

/** Same default as document-parser's hard timeout; ×2 is our staleness ceiling. */
const PARSE_TIMEOUT_MS = Number(process.env.DOC_PARSE_TIMEOUT_MS ?? 60_000);

function statusFileAbs(workspacePath: string, relPath: string): string {
  return path.join(workspacePath, STATUS_DIR, `${relPath}.json`);
}

export async function writeParseStatus(
  workspacePath: string,
  relPath: string,
  record: ParseStatusRecord,
): Promise<void> {
  const abs = statusFileAbs(workspacePath, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify(record), 'utf8');
}

/**
 * Read the parse status for a file. Returns null if no sidecar exists (e.g. a
 * plain-text file that never needed parsing). A `parsing` record older than
 * 2× the parse timeout is reported as `failed` (the worker likely died /
 * the process restarted) so the chip never spins forever.
 */
export async function readParseStatus(
  workspacePath: string,
  relPath: string,
): Promise<ParseStatusRecord | null> {
  try {
    const raw = await readFile(statusFileAbs(workspacePath, relPath), 'utf8');
    const record = JSON.parse(raw) as ParseStatusRecord;
    if (
      record.status === 'parsing' &&
      Date.now() - record.startedAt > PARSE_TIMEOUT_MS * 2
    ) {
      return { ...record, status: 'failed', error: '解析超时', updatedAt: Date.now() };
    }
    return record;
  } catch {
    return null;
  }
}
