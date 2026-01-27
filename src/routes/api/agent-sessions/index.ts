/**
 * Agent Sessions API
 *
 * GET /api/agent-sessions - List all sessions for current user
 * POST /api/agent-sessions - Create a new session (internal use by WS server)
 */

import { createFileRoute } from '@tanstack/react-router';
import { desc, eq, sql, and } from 'drizzle-orm';
import { db } from '~/db/db-config';
import { agentSession } from '~/db/schema';
import { requireUser } from '~/server/require-user';

export const Route = createFileRoute('/api/agent-sessions/')({
  validateSearch: (s) => ({
    page: Math.max(1, Number(s.page ?? 1)),
    limit: Math.max(1, Math.min(100, Number(s.limit ?? 20))),
  }),
  server: {
    handlers: {
      // GET /api/agent-sessions - List sessions
      GET: async ({ request }) => {
        const user = await requireUser(request);

        // Parse search params from URL (validateSearch doesn't run for direct API calls)
        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 20)));
        const offset = (page - 1) * limit;

        // Fetch sessions ordered by favorite first, then by updated_at
        const sessions = await db
          .select()
          .from(agentSession)
          .where(eq(agentSession.userId, user.id))
          .orderBy(
            desc(agentSession.favorite),
            desc(agentSession.updatedAt)
          )
          .limit(limit)
          .offset(offset);

        // Get total count for pagination
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(agentSession)
          .where(eq(agentSession.userId, user.id));

        const total = Number(countResult?.count ?? 0);

        return Response.json({
          sessions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      },

      // POST /api/agent-sessions - Create or update a session
      POST: async ({ request }) => {
        const user = await requireUser(request);

        const body = await request.json();
        const { sdkSessionId, claudeHomePath, title, realSdkSessionId } = body as {
          sdkSessionId: string;
          claudeHomePath?: string;
          title?: string;
          realSdkSessionId?: string;
        };

        if (!sdkSessionId) {
          return Response.json(
            { error: 'sdkSessionId is required' },
            { status: 400 }
          );
        }

        // Check if session already exists
        const [existing] = await db
          .select({ id: agentSession.id })
          .from(agentSession)
          .where(
            and(
              eq(agentSession.userId, user.id),
              eq(agentSession.sdkSessionId, sdkSessionId)
            )
          );

        if (existing) {
          // Update existing session
          const updateData: Partial<{
            lastMessageAt: Date;
            updatedAt: Date;
            title: string;
            realSdkSessionId: string;
            claudeHomePath: string;
          }> = {
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          };

          if (title) {
            updateData.title = title;
          }
          if (realSdkSessionId) {
            updateData.realSdkSessionId = realSdkSessionId;
          }
          if (claudeHomePath) {
            updateData.claudeHomePath = claudeHomePath;
          }

          await db
            .update(agentSession)
            .set(updateData)
            .where(eq(agentSession.id, existing.id));

          return Response.json({ id: existing.id, created: false });
        }

        // Create new session
        const [inserted] = await db
          .insert(agentSession)
          .values({
            userId: user.id,
            sdkSessionId,
            realSdkSessionId: realSdkSessionId || null,
            claudeHomePath: claudeHomePath || null,
            title: title || null,
          })
          .returning({ id: agentSession.id });

        return Response.json({ id: inserted.id, created: true });
      },
    },
  },
});
