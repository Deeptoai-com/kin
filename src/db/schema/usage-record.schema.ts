/**
 * Usage Record Schema (P2-1, observation-only)
 *
 * Persists per-run token/turn/cost data extracted from the SDK `result` event.
 * One row PER MODEL used in a run (a single run may use multiple models, e.g. a
 * main model plus a sub-agent model) — rows of the same run share `runId`.
 *
 * Purpose: accumulate real usage so we can later calibrate the credit conversion
 * rate (see docs/project/research/2026-05-billing-design.md). This table does NOT
 * charge anyone — metering/quota is P2-3.
 *
 * Important caveats (from billing-design.md):
 * - token counts ARE returned by the upstream API and are trustworthy.
 * - `costUsd` is the Claude Code SDK's LOCAL estimate against Anthropic list
 *   prices, NOT our real spend (we run a flat ¥200/month plan). It is stored for
 *   internal reference only and must NOT be used as a billing basis.
 */

import { boolean, index, integer, numeric, pgTable, text } from 'drizzle-orm/pg-core';
import { generateId } from '~/utils/id-generator';
import { user } from './auth.schema';
import { createdAt } from './_shared';

export const usageRecord = pgTable(
  'usage_record',
  {
    id: text('id')
      .$defaultFn(() => generateId('usage'))
      .primaryKey(),

    // Owner of the run.
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Workspace session id (our sdkSessionId). Nullable: a run may emit `result`
    // before the session id is known, or for sessionless background runs.
    sessionId: text('session_id'),

    // Groups all per-model rows belonging to the same run (one `result` event).
    runId: text('run_id').notNull(),

    // Model name as reported in modelUsage (e.g. "ark-code-latest",
    // "claude-haiku-4-5-20251001"). "unknown" when only top-level usage exists.
    model: text('model').notNull(),

    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),

    // Run-level turn count (repeated across the run's per-model rows).
    numTurns: integer('num_turns').notNull().default(0),

    // SDK's local USD estimate for this model. Internal reference only — see note
    // above. numeric to avoid float drift; Drizzle returns it as a string.
    costUsd: numeric('cost_usd', { precision: 14, scale: 6 }).notNull().default('0'),

    // Whether the run ended in an error (result.is_error / subtype !== 'success').
    isError: boolean('is_error').notNull().default(false),

    createdAt: createdAt(),
  },
  (table) => ({
    userIdIdx: index('usage_record_user_id_idx').on(table.userId),
    runIdIdx: index('usage_record_run_id_idx').on(table.runId),
    createdAtIdx: index('usage_record_created_at_idx').on(table.createdAt),
  }),
);
