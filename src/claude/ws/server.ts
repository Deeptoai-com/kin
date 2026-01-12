/**
 * WebSocket Server for Agent Chat
 *
 * Handles WebSocket connections for Claude Agent SDK communication.
 * Integrates with Vite dev server via the configureServer hook.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { ViteDevServer } from 'vite';
import { getSessionManager } from '~/claude/agent';
import { AgentSession } from '~/claude/agent';
import { auth } from '~/server/auth.server';
import { z } from 'zod';

// Inbound message schema
const InboundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('chat'),
    content: z.string().min(1),
    sessionId: z.string().optional(),
    thinking: z.string().optional(),
  }),
  z.object({
    type: z.literal('resume'),
    sessionId: z.string(),
  }),
  z.object({
    type: z.literal('abort'),
  }),
  z.object({
    type: z.literal('ping'),
  }),
]);

type InboundMessage = z.infer<typeof InboundMessageSchema>;

// User info attached to WebSocket
interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userEmail?: string;
  cookie?: string;
  isAlive?: boolean;
}

// Heartbeat interval: 30 seconds
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
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

async function fetchPermissionInfo(cookie: string) {
  try {
    const response = await fetch(`${APP_URL}/api/auth/permission-info`, {
      headers: { cookie },
    });

    if (!response.ok) {
      console.warn('[WS Server] Failed to fetch permission info:', response.status, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[WS Server] Error fetching permission info:', error);
    return null;
  }
}

/**
 * Create and configure WebSocket server
 */
export function createAgentWebSocketServer(server: ViteDevServer['httpServer']): WebSocketServer | null {
  if (!server) {
    console.warn('[WS Server] No HTTP server available');
    return null;
  }

  const wss = new WebSocketServer({
    noServer: true,
  });

  // Get session manager with environment config
  const sessionManager = getSessionManager({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    model: process.env.ANTHROPIC_MODEL,
    cwd: process.cwd(),
  });

  // Handle upgrade requests
  server.on('upgrade', async (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    // Only handle /ws/agent path
    if (url.pathname !== '/ws/agent') {
      return;
    }

    try {
      // Authenticate user from cookies
      const user = await authenticateRequest(request);

      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Complete WebSocket upgrade
      wss.handleUpgrade(request, socket, head, (ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        authWs.userId = user.id;
        authWs.userEmail = user.email;
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

  // Handle new connections
  wss.on('connection', async (ws: AuthenticatedWebSocket) => {
    console.log(`[WS Server] Client connected: ${ws.userEmail}`);

    const permissionInfo = await fetchPermissionInfo(ws.cookie || '');
    const orgSettings = permissionInfo && permissionInfo.userId === ws.userId
      ? {
        permissionMode: permissionInfo.permissionMode,
        allowBash: permissionInfo.allowBash,
        role: permissionInfo.role,
      }
      : undefined;

    // Get or create session for this user
    const session = sessionManager.getOrCreateSession(ws.userId!, orgSettings);
    sessionManager.attachWebSocket(ws, session);

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const raw = JSON.parse(data.toString());
        const message = InboundMessageSchema.parse(raw);

        await handleMessage(ws, session, message);
      } catch (error) {
        console.error('[WS Server] Message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          code: 'invalid_message',
          message: error instanceof Error ? error.message : 'Invalid message format',
          retriable: false,
        }));
      }
    });

    // Handle pong for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle close
    ws.on('close', () => {
      console.log(`[WS Server] Client disconnected: ${ws.userEmail}`);
      sessionManager.detachWebSocket(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[WS Server] WebSocket error for ${ws.userEmail}:`, error);
    });
  });

  // Heartbeat to detect dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (authWs.isAlive === false) {
        console.log(`[WS Server] Terminating dead connection: ${authWs.userEmail}`);
        return ws.terminate();
      }
      authWs.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeat);
    sessionManager.shutdown();
  });

  console.log('[WS Server] WebSocket server initialized on /ws/agent');
  return wss;
}

/**
 * Handle incoming WebSocket message
 */
async function handleMessage(
  ws: AuthenticatedWebSocket,
  session: AgentSession,
  message: InboundMessage
): Promise<void> {
  switch (message.type) {
    case 'chat':
      await session.chat(
        message.content,
        message.sessionId,
        resolveMaxThinkingTokens(message.thinking)
      );
      break;

    case 'resume':
      // For resume, we need to load previous session
      // This is a simplified version - just use the sessionId for next chat
      ws.send(JSON.stringify({
        type: 'session_init',
        sessionId: message.sessionId,
      }));
      break;

    case 'abort':
      session.interrupt();
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
  }
}

/**
 * Authenticate request using Better Auth cookies
 */
async function authenticateRequest(
  request: IncomingMessage
): Promise<{ id: string; email: string } | null> {
  try {
    // Extract cookies from request headers
    const cookieHeader = request.headers.cookie || '';

    // Create a mock Request object for Better Auth
    const mockRequest = new Request('http://localhost/api/auth/get-session', {
      headers: {
        cookie: cookieHeader,
      },
    });

    const session = await auth.api.getSession({ headers: mockRequest.headers });

    if (!session?.user) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
    };
  } catch (error) {
    console.error('[WS Server] Auth error:', error);
    return null;
  }
}

/**
 * Vite plugin to add WebSocket support
 */
export function agentWebSocketPlugin() {
  return {
    name: 'agent-websocket',
    configureServer(server: ViteDevServer) {
      createAgentWebSocketServer(server.httpServer);
    },
  };
}
