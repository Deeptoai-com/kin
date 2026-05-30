/**
 * Idle-connection reaper decision (S3) — pure predicate deciding whether a
 * WebSocket connection should be closed for inactivity.
 *
 * Used by ws-server's heartbeat loop to reap "zombie" connections (tab left
 * open, laptop asleep) that hold a connection slot without doing work. The
 * existing heartbeat already terminates *dead* sockets (no pong); this covers
 * *alive-but-idle* ones. Worker cleanup still happens in the socket's 'close'
 * handler, so reaping here never leaks a worker.
 *
 * Two guards keep it from firing wrongly:
 *  - a connection with an active worker is *serving* (a long query can stream
 *    for minutes with no inbound message) — never reap it;
 *  - a connection that has never been timestamped (e.g. pre-auth) is left to
 *    the heartbeat's liveness check instead.
 *
 * Note: only genuine business messages should refresh `lastActivityAt` — a
 * client keepalive ping must NOT, or a zombie tab that auto-pings would never
 * time out.
 *
 * Plain JS ESM so ws-server.mjs can import it without a build step.
 *
 * @param {object} params
 * @param {number} params.now             Current epoch ms (Date.now()).
 * @param {number} [params.lastActivityAt] Epoch ms of last business activity.
 * @param {boolean} params.hasActiveWorker Whether a worker is currently running.
 * @param {number} params.idleTimeoutMs   Idle ceiling in ms; <= 0 disables reaping.
 * @returns {boolean} true if the connection should be closed for inactivity.
 */
export function shouldReapIdle({ now, lastActivityAt, hasActiveWorker, idleTimeoutMs }) {
  if (!idleTimeoutMs || idleTimeoutMs <= 0) return false; // disabled
  if (hasActiveWorker) return false;                      // actively serving
  if (!lastActivityAt) return false;                      // never timestamped
  return now - lastActivityAt > idleTimeoutMs;
}
