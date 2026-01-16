/**
 * MCP Server Functions
 *
 * Server functions for MCP management using TanStack Start.
 */

import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import path from 'node:path';
import { auth } from '~/server/auth.server';
import {
  getMcpStore,
  getUserEnabledMcpServers,
  enableMcpServer,
  disableMcpServer,
  getMcpDetail,
  normalizeMcpName,
  getUserClaudeHome,
} from '~/claude/mcp';
import { runPython } from '~/claude/python/runner.js';

const requireUser = async () => {
  const { headers } = getRequest();
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
    throw new Error('UNAUTHORIZED');
  }

  return session.user;
};

const toggleSchema = z.object({
  slug: z.string().min(1),
});

const detailSchema = z.object({
  slug: z.string().min(1),
});

/**
 * List all MCP servers from the store
 */
export const listMcpStore = createServerFn({ method: 'GET' }).handler(async () => {
  return await getMcpStore();
});

/**
 * List enabled MCP servers for the current user
 */
export const listUserMcps = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser();
  const enabled = await getUserEnabledMcpServers(user.id);
  const store = await getMcpStore();
  return store.filter((entry) => enabled.includes(entry.slug));
});

/**
 * Enable MCP server
 */
export const enableMcpServerFn = createServerFn({ method: 'POST' })
  .inputValidator((input) => {
    const payload = typeof input === 'string' ? JSON.parse(input) : input;
    const data = payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data?: unknown }).data
      : payload;
    return toggleSchema.parse(data);
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    await enableMcpServer(user.id, data.slug);
    return { success: true };
  });

/**
 * Disable MCP server
 */
export const disableMcpServerFn = createServerFn({ method: 'POST' })
  .inputValidator((input) => {
    const payload = typeof input === 'string' ? JSON.parse(input) : input;
    const data = payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data?: unknown }).data
      : payload;
    return toggleSchema.parse(data);
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    await disableMcpServer(user.id, data.slug);
    return { success: true };
  });

/**
 * Get MCP detail (files + metadata)
 */
export const getMcpDetailFn = createServerFn({ method: 'GET' })
  .inputValidator((input) => {
    const searchParams = typeof input === 'string' ? new URLSearchParams(input) : null;
    const slug = searchParams?.get('slug')
      || (typeof input === 'object' && input && 'slug' in input ? (input as { slug?: string }).slug : null);
    return detailSchema.parse({ slug });
  })
  .handler(async ({ data }) => {
    return await getMcpDetail(data.slug);
  });

/**
 * Verify MCP server runtime (Python only for now)
 */
export const verifyMcpServerFn = createServerFn({ method: 'POST' })
  .inputValidator((input) => {
    const payload = typeof input === 'string' ? JSON.parse(input) : input;
    const data = payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data?: unknown }).data
      : payload;
    return toggleSchema.parse(data);
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const slug = normalizeMcpName(data.slug);

    if (slug !== 'python') {
      return {
        ok: false,
        message: `Verification not supported for ${slug}.`,
      };
    }

    const userHome = getUserClaudeHome(user.id);
    const cwd = path.join(userHome, 'mcp-verify');

    const code = `import importlib, json\n\nlibs = [\n  'numpy', 'pandas', 'matplotlib', 'PIL', 'yaml',\n  'scipy', 'seaborn', 'bs4', 'lxml'\n]\n\nresults = {}\nfor name in libs:\n  try:\n    module = importlib.import_module(name)\n    version = getattr(module, '__version__', None)\n    results[name] = {'ok': True, 'version': version}\n  except Exception as e:\n    results[name] = {'ok': False, 'error': str(e)}\n\nprint(json.dumps(results))\n`;

    const result = await runPython({ code, cwd, timeoutMs: 10_000, maxOutputBytes: 256_000 });

    let parsed = null;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch {
      parsed = null;
    }

    const allOk = parsed
      ? Object.values(parsed).every((entry) => entry && entry.ok === true)
      : false;

    return {
      ok: !result.timedOut && !result.killedByLimit && result.exitCode === 0 && allOk,
      details: parsed,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      truncated: result.truncated,
    };
  });

/**
 * List all MCP servers (official + user)
 */
export const listAllMcpsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await requireUser();
    const store = await getMcpStore();
    const enabled = await getUserEnabledMcpServers(user.id);

    const official = store.map((entry) => ({
      ...entry,
      store: 'official' as const,
      enabled: enabled.includes(entry.slug),
    }));

    return {
      official,
      user: [],
    };
  });
