/**
 * Usage API (P2-1, observation-only)
 *
 * POST /api/usage - Record per-run token/turn/cost usage (internal use by WS server).
 *
 * The WS server forwards the SDK `result` event's usage data here after each run.
 * One run may use multiple models (modelUsage); we insert one row per model, all
 * sharing a generated runId. This does NOT charge credits — metering is P2-3.
 *
 * See docs/project/research/2026-05-billing-design.md for why costUsd is stored
 * for internal reference only and is NOT a billing basis.
 */

import { createFileRoute } from '@tanstack/react-router';
import { randomUUID } from 'node:crypto';
import { db } from '~/db/db-config';
import { usageRecord } from '~/db/schema';
import { requireUser } from '~/server/require-user';
import { buildUsageRows, type UsageBody } from '~/server/usage/build-usage-rows';

export const Route = createFileRoute('/api/usage/')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await requireUser(request);

        const body = (await request.json()) as UsageBody;
        const runId = `run_${randomUUID()}`;
        const rows = buildUsageRows(user.id, body, runId);

        await db.insert(usageRecord).values(rows);

        return Response.json({ recorded: rows.length, runId });
      },
    },
  },
});
