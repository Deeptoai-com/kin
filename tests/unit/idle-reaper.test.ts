/**
 * Unit tests for the idle-connection reaper predicate (S3).
 *
 * Encodes the contract ws-server's heartbeat relies on: reap only alive-but-idle
 * connections, never one with an active worker (it may be streaming a long
 * query), never a never-timestamped connection, and never when disabled.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error - .js module without type declarations
import { shouldReapIdle } from '../../src/server/concurrency/idle-reaper.js';

const TIMEOUT = 15 * 60 * 1000; // 900_000 ms (default)
const NOW = 1_000_000_000_000;

describe('shouldReapIdle', () => {
  it('reaps a connection idle beyond the timeout (no active worker)', () => {
    expect(
      shouldReapIdle({
        now: NOW,
        lastActivityAt: NOW - TIMEOUT - 1,
        hasActiveWorker: false,
        idleTimeoutMs: TIMEOUT,
      }),
    ).toBe(true);
  });

  it('does NOT reap a connection idle within the timeout', () => {
    expect(
      shouldReapIdle({
        now: NOW,
        lastActivityAt: NOW - TIMEOUT + 1,
        hasActiveWorker: false,
        idleTimeoutMs: TIMEOUT,
      }),
    ).toBe(false);
  });

  it('does NOT reap exactly at the boundary (strict greater-than)', () => {
    expect(
      shouldReapIdle({
        now: NOW,
        lastActivityAt: NOW - TIMEOUT,
        hasActiveWorker: false,
        idleTimeoutMs: TIMEOUT,
      }),
    ).toBe(false);
  });

  it('never reaps a connection with an active worker (long query streaming)', () => {
    expect(
      shouldReapIdle({
        now: NOW,
        lastActivityAt: NOW - TIMEOUT * 10, // very idle on inbound...
        hasActiveWorker: true, // ...but actively serving
        idleTimeoutMs: TIMEOUT,
      }),
    ).toBe(false);
  });

  it('never reaps a connection that was never timestamped', () => {
    for (const lastActivityAt of [undefined, 0, null as unknown as number]) {
      expect(
        shouldReapIdle({
          now: NOW,
          lastActivityAt,
          hasActiveWorker: false,
          idleTimeoutMs: TIMEOUT,
        }),
      ).toBe(false);
    }
  });

  it('is disabled when idleTimeoutMs is 0 or negative', () => {
    for (const idleTimeoutMs of [0, -1]) {
      expect(
        shouldReapIdle({
          now: NOW,
          lastActivityAt: NOW - TIMEOUT * 100,
          hasActiveWorker: false,
          idleTimeoutMs,
        }),
      ).toBe(false);
    }
  });
});
