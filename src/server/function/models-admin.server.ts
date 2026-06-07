/**
 * Multi-model admin server functions (PR6).
 *
 * Admin-only board controls: list all models (incl. disabled/unhealthy) with health,
 * toggle enabled, set the default, and enqueue a re-probe. Connection/model CRUD
 * forms are a fast-follow (PR6b); definitions bootstrap from OXY_MODELS_SEED. All
 * fns require system admin; none return a token value.
 */

import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { auth } from '~/server/auth.server';
import {
  listModelsAdmin,
  setModelEnabled,
  setDefaultModelById,
  type AdminModelRow,
} from '~/server/models/registry';
import { systemQueue } from '~/jobs/queues';

const requireAdmin = async () => {
  const { headers } = getRequest();
  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new Error('UNAUTHORIZED');
  const { db } = await import('~/db/db-config');
  const { user: userTable } = await import('~/db/schema');
  const { eq } = await import('drizzle-orm');
  const userData = await db.query.user.findFirst({
    where: eq(userTable.id, session.user.id),
    columns: { systemRole: true },
  });
  if (userData?.systemRole !== 'admin') throw new Error('FORBIDDEN: Admin access required');
  return session.user;
};

export const listModelsAdminFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminModelRow[]> => {
    await requireAdmin();
    return listModelsAdmin();
  },
);

export const setModelEnabledFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().min(1), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    await setModelEnabled(data.id, data.enabled);
    return { ok: true };
  });

export const setDefaultModelFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    await setDefaultModelById(data.id);
    return { ok: true };
  });

/** Enqueue a health re-probe (one model when modelId given, else the full sweep). */
export const reprobeModelsFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ modelId: z.string().optional() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    await systemQueue.add('probe-models', data.modelId ? { modelId: data.modelId } : {});
    return { ok: true };
  });
