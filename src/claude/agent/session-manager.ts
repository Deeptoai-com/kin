/**
 * SessionManager - Manages all active AgentSessions
 *
 * Responsibilities:
 * - Create and track sessions by user ID
 * - Clean up expired/abandoned sessions
 * - Map WebSocket connections to sessions
 */

import { AgentSession, type AgentSessionConfig } from './session';
import type { OrganizationPermissionSettings } from '~/claude/permissions';
import type { WebSocket } from 'ws';

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Cleanup interval: check every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export interface SessionInfo {
  session: AgentSession;
  userId: string;
  createdAt: number;
}

export class SessionManager {
  private sessions: Map<string, SessionInfo> = new Map();
  private wsToSession: Map<WebSocket, AgentSession> = new Map();
  private config: AgentSessionConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private sessionsRoot: string;

  constructor(config: AgentSessionConfig = {}) {
    this.config = config;
    // Get sessions root from environment or use default
    this.sessionsRoot = process.env.CLAUDE_SESSIONS_ROOT || '/tmp/claude-sessions';
    console.log(`[SessionManager] Sessions root: ${this.sessionsRoot}`);
    this.startCleanup();
  }

  /**
   * Get or create a session for a user
   */
  getOrCreateSession(userId: string, orgSettings?: OrganizationPermissionSettings): AgentSession {
    // Check if user already has an active session
    for (const [_key, info] of this.sessions) {
      if (info.userId === userId) {
        info.session.lastActivity = Date.now();
        info.session.setOrgSettings(orgSettings);
        return info.session;
      }
    }

    // Create new session with user-specific configuration
    const session = new AgentSession({
      ...this.config,
      userId,
      sessionsRoot: this.sessionsRoot,
      orgSettings,
    });
    const sessionKey = `${userId}-${Date.now()}`;

    this.sessions.set(sessionKey, {
      session,
      userId,
      createdAt: Date.now(),
    });

    console.log(`[SessionManager] Created new session for user ${userId} (total: ${this.sessions.size})`);
    return session;
  }

  /**
   * Associate a WebSocket with a session
   */
  attachWebSocket(ws: WebSocket, session: AgentSession): void {
    // Detach from any previous session
    const prevSession = this.wsToSession.get(ws);
    if (prevSession && prevSession !== session) {
      prevSession.unsubscribe(ws);
    }

    this.wsToSession.set(ws, session);
    session.subscribe(ws);
  }

  /**
   * Handle WebSocket disconnection
   */
  detachWebSocket(ws: WebSocket): void {
    const session = this.wsToSession.get(ws);
    if (session) {
      session.unsubscribe(ws);
      this.wsToSession.delete(ws);
    }
  }

  /**
   * Get session associated with a WebSocket
   */
  getSessionForWebSocket(ws: WebSocket): AgentSession | undefined {
    return this.wsToSession.get(ws);
  }

  /**
   * Start periodic cleanup of expired sessions
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, info] of this.sessions) {
      const isExpired = now - info.session.lastActivity > SESSION_TIMEOUT_MS;
      const hasNoClients = !info.session.hasClients();
      const isNotBusy = !info.session.busy;

      if (isExpired && hasNoClients && isNotBusy) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const info = this.sessions.get(key);
      if (info) {
        info.session.interrupt(); // Ensure any pending work is stopped
        this.sessions.delete(key);
        console.log(`[SessionManager] Cleaned up expired session for user ${info.userId}`);
      }
    }

    if (expiredKeys.length > 0) {
      console.log(`[SessionManager] Cleaned up ${expiredKeys.length} expired sessions (remaining: ${this.sessions.size})`);
    }
  }

  /**
   * Shutdown the session manager
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Interrupt all active sessions
    for (const [_key, info] of this.sessions) {
      info.session.interrupt();
    }
    this.sessions.clear();
    this.wsToSession.clear();

    console.log('[SessionManager] Shutdown complete');
  }

  /**
   * Get stats for debugging
   */
  getStats(): { totalSessions: number; totalConnections: number } {
    return {
      totalSessions: this.sessions.size,
      totalConnections: this.wsToSession.size,
    };
  }
}

// Singleton instance
let instance: SessionManager | null = null;

export function getSessionManager(config?: AgentSessionConfig): SessionManager {
  if (!instance) {
    instance = new SessionManager(config);
  }
  return instance;
}
