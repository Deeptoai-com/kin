/**
 * AgentSession - Manages a single Claude Agent SDK session
 *
 * Responsibilities:
 * - Wraps Claude Agent SDK query() calls
 * - Manages AbortController for interruption
 * - Tracks session state (busy, error)
 * - Broadcasts SDK events to connected WebSocket clients
 */

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { WebSocket } from 'ws';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { db } from '~/db/db-config';
import { agentSession } from '~/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  resolveDisallowedTools,
  resolvePermissionMode,
  shouldSkipPermissions,
  type OrganizationPermissionSettings,
} from '~/claude/permissions';
import { createPathSecurity } from '~/claude/path-security';

// Outbound message types sent to WebSocket clients
export type OutboundMessage =
  | { type: 'session_init'; sessionId: string }
  | { type: 'message'; event: SDKMessage }
  | { type: 'error'; code: string; message: string; retriable: boolean }
  | { type: 'done' }
  | { type: 'pong' };

export interface AgentSessionConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  cwd?: string;
  permissionMode?: string;
  userId?: string;           // User ID for isolation
  sessionsRoot?: string;     // Root directory for user sessions
  orgSettings?: OrganizationPermissionSettings;  // Organization-based permission settings
}

export class AgentSession {
  public sessionId: string | null = null;
  public lastActivity: number = Date.now();
  public error: Error | string | undefined;
  public readonly userId: string | undefined;

  private config: AgentSessionConfig;
  private abortController: AbortController | undefined;
  private isBusy: boolean = false;
  private clients: Set<WebSocket> = new Set();
  private claudeHome: string | undefined;
  private claudeHomeInitialized: boolean = false;
  private dbRecordId: string | null = null;  // Database record ID

  constructor(config: AgentSessionConfig = {}) {
    this.config = config;
    this.userId = config.userId;

    // Calculate user-specific CLAUDE_HOME path
    if (config.userId && config.sessionsRoot) {
      // Sanitize userId to prevent path traversal attacks
      const safeUserId = this.sanitizeUserId(config.userId);
      this.claudeHome = path.join(config.sessionsRoot, safeUserId);
    }
  }

  setOrgSettings(orgSettings?: OrganizationPermissionSettings): void {
    this.config.orgSettings = orgSettings;
    if (orgSettings?.permissionMode) {
      this.config.permissionMode = orgSettings.permissionMode;
    }
  }

  /**
   * Sanitize userId to prevent path traversal and other security issues
   */
  private sanitizeUserId(userId: string): string {
    // Remove any path separators and dangerous characters
    return userId.replace(/[\/\\\.]+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Ensure the CLAUDE_HOME directory exists
   */
  private async ensureClaudeHomeExists(): Promise<void> {
    if (this.claudeHome && !this.claudeHomeInitialized) {
      try {
        await mkdir(this.claudeHome, { recursive: true });
        this.claudeHomeInitialized = true;
        console.log(`[AgentSession] Created CLAUDE_HOME directory: ${this.claudeHome}`);
      } catch (error) {
        console.error(`[AgentSession] Failed to create CLAUDE_HOME directory:`, error);
        throw error;
      }
    }
  }

  /**
   * Persist session metadata to database
   */
  private async persistSessionToDatabase(sdkSessionId: string): Promise<void> {
    if (!this.userId || !this.claudeHome || this.dbRecordId) {
      return;
    }

    try {
      // Insert or get existing record (upsert behavior)
      const [existing] = await db
        .select({ id: agentSession.id })
        .from(agentSession)
        .where(and(
          eq(agentSession.userId, this.userId),
          eq(agentSession.sdkSessionId, sdkSessionId)
        ));

      if (existing) {
        this.dbRecordId = existing.id;
        console.log(`[AgentSession] Found existing DB record: ${existing.id}`);
      } else {
        const [inserted] = await db
          .insert(agentSession)
          .values({
            userId: this.userId,
            sdkSessionId,
            claudeHomePath: this.claudeHome,
            title: null,  // Will be extracted later
          })
          .returning({ id: agentSession.id });

        if (inserted) {
          this.dbRecordId = inserted.id;
          console.log(`[AgentSession] Created DB record: ${inserted.id}`);
        }
      }
    } catch (error) {
      console.error('[AgentSession] Failed to persist session to database:', error);
      // Don't throw - database persistence is non-critical for SDK operation
    }
  }

  /**
   * Update session timestamp in database
   */
  private async updateSessionTimestamp(): Promise<void> {
    if (!this.dbRecordId) {
      return;
    }

    try {
      await db
        .update(agentSession)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentSession.id, this.dbRecordId));
    } catch (error) {
      console.error('[AgentSession] Failed to update session timestamp:', error);
    }
  }

  /**
   * Subscribe a WebSocket client to receive events
   */
  subscribe(ws: WebSocket): void {
    this.clients.add(ws);
    console.log(`[AgentSession] Client subscribed (total: ${this.clients.size})`);

    // Send current session state if we have a session
    if (this.sessionId) {
      this.send(ws, { type: 'session_init', sessionId: this.sessionId });
    }
  }

  /**
   * Unsubscribe a WebSocket client
   */
  unsubscribe(ws: WebSocket): void {
    this.clients.delete(ws);
    console.log(`[AgentSession] Client unsubscribed (remaining: ${this.clients.size})`);
  }

  /**
   * Check if session has any connected clients
   */
  hasClients(): boolean {
    return this.clients.size > 0;
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: OutboundMessage): void {
    const data = JSON.stringify(message);
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * Send message to a specific client
   */
  private send(ws: WebSocket, message: OutboundMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Interrupt the current query
   */
  interrupt(): void {
    if (this.abortController) {
      this.abortController.abort('user_interrupt');
      this.abortController = undefined;
    }
    this.isBusy = false;
  }

  /**
   * Check if session is currently processing a query
   */
  get busy(): boolean {
    return this.isBusy;
  }

  /**
   * Process a chat message from the user
   */
  async chat(prompt: string, resumeSessionId?: string, maxThinkingTokens?: number): Promise<void> {
    if (this.isBusy) {
      this.broadcast({
        type: 'error',
        code: 'busy',
        message: 'Session is busy processing another request',
        retriable: true,
      });
      return;
    }

    this.isBusy = true;
    this.error = undefined;
    this.abortController = new AbortController();
    this.lastActivity = Date.now();

    try {
      // Ensure user-specific CLAUDE_HOME directory exists
      await this.ensureClaudeHomeExists();

      // Build environment variables for custom API endpoint
      const customEnv: Record<string, string | undefined> = { ...process.env };

      // Set user-specific CLAUDE_HOME for session isolation
      if (this.claudeHome) {
        customEnv.CLAUDE_HOME = this.claudeHome;
        console.log(`[AgentSession] CLAUDE_HOME set to ${this.claudeHome}`);
      }

      if (this.config.apiKey) {
        customEnv.ANTHROPIC_API_KEY = this.config.apiKey;
      }
      if (this.config.baseURL) {
        customEnv.ANTHROPIC_BASE_URL = this.config.baseURL;
        customEnv.ANTHROPIC_API_URL = this.config.baseURL;
      }
      if (this.config.model) {
        customEnv.ANTHROPIC_MODEL = this.config.model;
      }

      const permissionMode = resolvePermissionMode(
        this.userId,
        this.config.permissionMode,
        this.config.orgSettings
      );
      const disallowedTools = resolveDisallowedTools(permissionMode, this.config.orgSettings);
      const allowDangerouslySkipPermissions = shouldSkipPermissions(permissionMode);
      const { canUseTool, debugInfo } = createPathSecurity({
        workspace: this.config.cwd || process.cwd(),
        userId: this.userId,
        claudeHome: this.claudeHome,
        sessionsRoot: this.config.sessionsRoot,
      });
      if (process.env.CLAUDE_SECURITY_DEBUG === 'true') {
        console.error(`[AgentSession] Path Security: ${JSON.stringify(debugInfo)}`);
      }

      // Call Claude Agent SDK
      const stream = query({
        prompt,
        options: {
          cwd: this.config.cwd || process.cwd(),
          model: this.config.model,
          permissionMode,
          disallowedTools,
          ...(allowDangerouslySkipPermissions && { allowDangerouslySkipPermissions: true }),
          ...(permissionMode !== 'bypassPermissions' && { canUseTool }),
          ...(Number.isFinite(maxThinkingTokens) && { maxThinkingTokens }),
          abortController: this.abortController,
          // Resume from existing session if provided
          ...(resumeSessionId && { resume: resumeSessionId }),
          env: customEnv,
        },
      });

      // Stream SDK events to all connected clients
      for await (const event of stream) {
        this.lastActivity = Date.now();

        // Extract session_id from system:init event
        if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
          this.sessionId = event.session_id;

          // Persist session to database (if not already saved)
          await this.persistSessionToDatabase(event.session_id);

          this.broadcast({ type: 'session_init', sessionId: event.session_id });
        }

        // Broadcast the raw SDK event
        this.broadcast({ type: 'message', event });
      }

      // Update last message timestamp in database
      await this.updateSessionTimestamp();

      // Signal completion
      this.broadcast({ type: 'done' });
    } catch (error) {
      console.error('[AgentSession] Query error:', error);
      this.error = error instanceof Error ? error : String(error);

      const isAborted = this.abortController?.signal.aborted;
      this.broadcast({
        type: 'error',
        code: isAborted ? 'aborted' : 'server_error',
        message: error instanceof Error ? error.message : String(error),
        retriable: !isAborted,
      });
    } finally {
      this.isBusy = false;
      this.abortController = undefined;
    }
  }
}
