/**
 * Workspace files server functions (上传链路根治 PRD §3.1).
 *
 * `getWorkspaceParseStatus` reports the background-parse status of composer
 * attachments. The upload route (POST /api/workspace/:sessionId/files) now
 * returns immediately and parses rich docs in the background; the composer polls
 * this until the status is terminal (parsed | scanned | failed).
 *
 * Server function (not a REST route) per the project rule "禁止使用 REST API 路由";
 * the upload itself stays a route only because it's multipart file bytes.
 */
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import path from 'node:path';
import { requireUser } from '~/server/require-user';
import { getWorkspaceSession } from '~/server/workspace-session';
import { validateRelativePath } from '~/server/security/validate-relative-path';
import { readParseStatus, type ParseStatusValue } from '~/server/documents/parse-status';

export interface ParseStatusEntry {
  status: ParseStatusValue;
  /** Workspace-relative `.md` the Agent should Read (parsed/scanned only). */
  parsedPath?: string;
  engine?: string;
  error?: string;
}

export type ParseStatusMap = Record<string, ParseStatusEntry>;

export const getWorkspaceParseStatus = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      sessionId: z.string().min(1),
      paths: z.array(z.string()).min(1).max(50),
    }),
  )
  .handler(async ({ data }): Promise<ParseStatusMap> => {
    const user = await requireUser(getRequest());
    const session = await getWorkspaceSession(user.id, data.sessionId);
    if (!session) return {};

    const workspacePath = path.join(
      session.claudeHomePath,
      'sessions',
      session.sdkSessionId,
      'workspace',
    );

    const result: ParseStatusMap = {};
    await Promise.all(
      data.paths.map(async (relPath) => {
        if (!validateRelativePath(relPath)) return;
        const record = await readParseStatus(workspacePath, relPath);
        // No sidecar → the file never needed parsing (plain text/code): ready.
        result[relPath] = record
          ? { status: record.status, parsedPath: record.parsedPath, engine: record.engine, error: record.error }
          : { status: 'parsed' };
      }),
    );
    return result;
  });
