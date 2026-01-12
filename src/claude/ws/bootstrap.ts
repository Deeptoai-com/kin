/**
 * WebSocket Bootstrap - Standalone entry point for WebSocket server
 *
 * This file avoids path alias imports to work with Vite's configureServer hook.
 * It uses relative imports and minimal dependencies.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { resolveDisallowedTools, resolvePermissionMode, shouldSkipPermissions } from '../permissions';
import { createPathSecurity } from '../path-security';

// Process-level error handlers to prevent crashes from unhandled rejections
if (typeof process !== 'undefined') {
  process.on('uncaughtException', (err) => {
    console.error('[WS Server] UNCAUGHT EXCEPTION:', err);
    // Don't exit - keep server running
  });
  process.on('unhandledRejection', (reason, _promise) => {
    console.error('[WS Server] UNHANDLED REJECTION:', reason);
    // Don't exit - keep server running
  });
}

// Configuration from environment
const config = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
  model: process.env.ANTHROPIC_MODEL,
  cwd: process.cwd(),
};

// Outbound message types
type OutboundMessage =
  | { type: 'session_init'; sessionId: string }
  | { type: 'message'; event: SDKMessage }
  | { type: 'error'; code: string; message: string; retriable: boolean }
  | { type: 'done' }
  | { type: 'pong' };

// WebSocket with user info
interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  cookie?: string;
  isAlive?: boolean;
  sessionId?: string | null;
  abortController?: AbortController;
}

const HEARTBEAT_INTERVAL_MS = 30 * 1000;

// App URL for API calls (same as ws-server.mjs)
const APP_URL = process.env.APP_URL || 'http://localhost:5000';
const MAX_THINKING_TOKENS = Number.parseInt(process.env.CLAUDE_MAX_THINKING_TOKENS || '', 10);

function resolveMaxThinkingTokens(thinkingMode?: string): number | undefined {
  if (thinkingMode !== 'extended') {
    return undefined;
  }
  return Number.isFinite(MAX_THINKING_TOKENS) && MAX_THINKING_TOKENS > 0
    ? MAX_THINKING_TOKENS
    : undefined;
}

/**
 * Fetch permission info from the API
 * Returns organization-based permission settings or falls back to environment variables
 */
async function fetchPermissionInfo(cookie: string) {
  try {
    const response = await fetch(`${APP_URL}/api/auth/permission-info`, {
      headers: { cookie },
    });

    if (!response.ok) {
      console.warn('[WS Server] Failed to fetch permission info:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[WS Server] Error fetching permission info:', error);
    return null;
  }
}

/**
 * Create WebSocket server for Agent Chat
 */
export function createAgentWebSocketServer(httpServer: Server | null): WebSocketServer | null {
  if (!httpServer) {
    console.warn('[WS Server] No HTTP server available');
    return null;
  }

  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests
  httpServer.on('upgrade', async (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname !== '/ws/agent') {
      return;
    }

    try {
      // Authenticate using the session cookie
      const user = await authenticateRequest(request);

      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        authWs.userId = user.id;
        authWs.cookie = request.headers.cookie || '';
        authWs.isAlive = true;
        wss.emit('connection', authWs, request);
      });
    } catch (error) {
      console.error('[WS Server] Upgrade error:', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  // Handle connections
  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    console.log(`[WS Server] Client connected: ${ws.userId}`);

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log('[WS Server] Received message:', msg.type, msg.content?.slice?.(0, 50) || '');
        await handleMessage(ws, msg);
      } catch (error) {
        console.error('[WS Server] Message error:', error);
        sendMessage(ws, {
          type: 'error',
          code: 'invalid_message',
          message: error instanceof Error ? error.message : 'Invalid message',
          retriable: false,
        });
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      console.log(`[WS Server] Client disconnected: ${ws.userId}`);
      ws.abortController?.abort();
    });

    ws.on('error', (error) => {
      console.error(`[WS Server] Error for ${ws.userId}:`, error);
    });
  });

  // Heartbeat
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (authWs.isAlive === false) {
        return ws.terminate();
      }
      authWs.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  console.log('[WS Server] WebSocket server initialized on /ws/agent');
  return wss;
}

/**
 * Send message to WebSocket
 */
function sendMessage(ws: AuthenticatedWebSocket, msg: OutboundMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Handle incoming message
 */
async function handleMessage(ws: AuthenticatedWebSocket, msg: unknown): Promise<void> {
  const message = msg as { type: string; content?: string; sessionId?: string; thinking?: string };

  switch (message.type) {
    case 'chat':
      if (!message.content) {
        sendMessage(ws, {
          type: 'error',
          code: 'invalid_message',
          message: 'Missing content',
          retriable: false,
        });
        return;
      }
      await handleChat(ws, message.content, message.sessionId, message.thinking);
      break;

    case 'abort':
      ws.abortController?.abort('user_interrupt');
      break;

    case 'ping':
      sendMessage(ws, { type: 'pong' });
      break;

    default:
      sendMessage(ws, {
        type: 'error',
        code: 'unknown_message_type',
        message: `Unknown message type: ${message.type}`,
        retriable: false,
      });
  }
}

/**
 * Handle chat message
 */
async function handleChat(
  ws: AuthenticatedWebSocket,
  prompt: string,
  resumeSessionId?: string,
  thinkingMode?: string
): Promise<void> {
  console.log('[WS Server] handleChat starting...', { prompt: prompt.slice(0, 50), resumeSessionId });

  // Abort any existing query
  ws.abortController?.abort();
  ws.abortController = new AbortController();

  try {
    // Build environment
    const customEnv: Record<string, string | undefined> = { ...process.env };
    console.log('[WS Server] Building query with model:', config.model);
    if (config.apiKey) customEnv.ANTHROPIC_API_KEY = config.apiKey;
    if (config.baseURL) {
      customEnv.ANTHROPIC_BASE_URL = config.baseURL;
      customEnv.ANTHROPIC_API_URL = config.baseURL;
    }
    if (config.model) customEnv.ANTHROPIC_MODEL = config.model;

    // Fetch permission info from API (includes organization settings)
    const permissionInfo = await fetchPermissionInfo(ws.cookie || '');

    // Use fetched permission info or fall back to environment variables
    let permissionMode, orgSettings, organizationId, role;
    if (permissionInfo && permissionInfo.userId === ws.userId) {
      permissionMode = permissionInfo.permissionMode;
      orgSettings = {
        permissionMode: permissionMode,
        allowBash: permissionInfo.allowBash,
        role: permissionInfo.role,
      };
      organizationId = permissionInfo.organizationId;
      role = permissionInfo.role;
      console.log(`[WS Server] Using organization-based permissions: org=${organizationId}, role=${role}, mode=${permissionMode}`);
    } else {
      // Fallback to environment variables
      permissionMode = resolvePermissionMode(ws.userId);
      orgSettings = undefined;
      organizationId = null;
      role = null;
      console.log(`[WS Server] Using environment-based permissions: mode=${permissionMode}`);
    }

    const disallowedTools = resolveDisallowedTools(permissionMode, orgSettings);
    const maxThinkingTokens = resolveMaxThinkingTokens(thinkingMode);
    const allowDangerouslySkipPermissions = shouldSkipPermissions(permissionMode);
    const { canUseTool, debugInfo } = createPathSecurity({
      workspace: config.cwd,
      userId: ws.userId,
      claudeHome: customEnv.CLAUDE_HOME,
      sessionsRoot: process.env.CLAUDE_SESSIONS_ROOT,
    });
    if (process.env.CLAUDE_SECURITY_DEBUG === 'true') {
      console.error(`[WS Server] Path Security: ${JSON.stringify(debugInfo)}`);
    }

    // Call SDK
    console.log('[WS Server] Calling SDK query...');
    const stream = query({
      prompt,
      options: {
        cwd: config.cwd,
        model: config.model,
        permissionMode,
        disallowedTools,
        ...(allowDangerouslySkipPermissions && { allowDangerouslySkipPermissions: true }),
        ...(permissionMode !== 'bypassPermissions' && { canUseTool }),
        ...(Number.isFinite(maxThinkingTokens) && { maxThinkingTokens }),
        abortController: ws.abortController,
        ...(resumeSessionId && { resume: resumeSessionId }),
        env: customEnv,
      },
    });

    console.log('[WS Server] Starting to stream events...');
    // Stream events
    for await (const event of stream) {
      // Extract session_id
      if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
        ws.sessionId = event.session_id;
        sendMessage(ws, { type: 'session_init', sessionId: event.session_id });
      }

      sendMessage(ws, { type: 'message', event });
    }

    sendMessage(ws, { type: 'done' });
  } catch (error) {
    console.error('[WS Server] Chat error:', error);
    const isAborted = ws.abortController?.signal.aborted;
    sendMessage(ws, {
      type: 'error',
      code: isAborted ? 'aborted' : 'server_error',
      message: error instanceof Error ? error.message : String(error),
      retriable: !isAborted,
    });
  }
}

/**
 * Authenticate request using session cookie
 *
 * In development mode, we skip HTTP-based auth to avoid Nitro worker timeout issues.
 * Production uses ws-server.mjs which has proper HTTP auth against the main app.
 */
async function authenticateRequest(
  request: IncomingMessage
): Promise<{ id: string } | null> {
  const cookie = request.headers.cookie || '';

  // In development, skip HTTP call to avoid Nitro worker timeout
  // Just check if a session cookie exists
  const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? 'ex0_session';
  const hasSessionCookie = cookie.includes(`${sessionCookieName}=`);

  if (hasSessionCookie) {
    // Extract a pseudo user ID from cookie for dev mode
    // This is safe because dev mode is localhost only
    const match = cookie.match(new RegExp(`${sessionCookieName}=([^;]+)`));
    const token = match?.[1] || 'dev-user';
    return { id: `dev-${token.slice(0, 8)}` };
  }

  console.warn('[WS Server] No session cookie found');
  return null;
}
