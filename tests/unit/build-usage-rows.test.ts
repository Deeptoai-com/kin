/**
 * Unit tests for buildUsageRows (P2-1) — the pure transform that maps an SDK
 * `result` usage payload into per-model DB rows.
 *
 * The multi-model fixture is the REAL Ark `result` event captured in
 * docs/project/research/2026-05-billing-design.md, so this test pins the exact
 * shape we observed in production.
 */
import { describe, it, expect } from 'vitest';
import { buildUsageRows } from '~/server/usage/build-usage-rows';

const RUN = 'run_test';
const USER = 'user_test';

describe('buildUsageRows', () => {
  it('emits one row per model from the real Ark result payload', () => {
    const rows = buildUsageRows(
      USER,
      {
        sessionId: 'sess_abc',
        usage: { input_tokens: 14067, output_tokens: 4 },
        numTurns: 1,
        totalCostUsd: 0.044149,
        modelUsage: {
          'claude-haiku-4-5-20251001': { inputTokens: 1378, outputTokens: 102, costUSD: 0.001888 },
          'ark-code-latest': { inputTokens: 14067, outputTokens: 4, costUSD: 0.042261 },
        },
        isError: false,
      },
      RUN,
    );

    expect(rows).toHaveLength(2);
    const ark = rows.find((r) => r.model === 'ark-code-latest')!;
    expect(ark).toMatchObject({
      userId: USER,
      sessionId: 'sess_abc',
      runId: RUN,
      inputTokens: 14067,
      outputTokens: 4,
      numTurns: 1,
      costUsd: '0.042261',
      isError: false,
    });
    const haiku = rows.find((r) => r.model === 'claude-haiku-4-5-20251001')!;
    expect(haiku.inputTokens).toBe(1378);
    expect(haiku.costUsd).toBe('0.001888');
    // every per-model row carries the run-level turn count
    expect(rows.every((r) => r.numTurns === 1)).toBe(true);
  });

  it('falls back to a single "unknown" row from top-level usage when modelUsage is empty', () => {
    const rows = buildUsageRows(
      USER,
      {
        sessionId: null,
        usage: { input_tokens: 500, output_tokens: 20 },
        numTurns: 2,
        totalCostUsd: 0.01,
        modelUsage: {},
        isError: false,
      },
      RUN,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      model: 'unknown',
      sessionId: null,
      inputTokens: 500,
      outputTokens: 20,
      numTurns: 2,
      costUsd: '0.010000',
    });
  });

  it('records errored runs (is_error) and still captures their tokens', () => {
    const rows = buildUsageRows(
      USER,
      {
        usage: { input_tokens: 10, output_tokens: 0 },
        numTurns: 1,
        modelUsage: { 'ark-code-latest': { inputTokens: 10, outputTokens: 0, costUSD: 0.0001 } },
        isError: true,
      },
      RUN,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].isError).toBe(true);
    expect(rows[0].inputTokens).toBe(10);
  });

  it('coerces missing/garbage numerics to safe defaults (0 tokens, "0" cost)', () => {
    const rows = buildUsageRows(USER, { modelUsage: null }, RUN);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      model: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      numTurns: 0,
      costUsd: '0',
      isError: false,
    });
  });
});
