/**
 * Admin · Model health board (PR6)
 *
 * Lists ALL configured models (incl. disabled/unhealthy) grouped by connection,
 * with health + last-probe + reason + latency. Admins can enable/disable, set the
 * default, and trigger a re-probe. Admin access is enforced by the parent /admin
 * loader (requireSystemAdmin) and again by the server fns (requireAdmin).
 *
 * Connection/model CRUD forms are a fast-follow (PR6b); definitions bootstrap from
 * OXY_MODELS_SEED. Tokens are never shown — only whether the tokenEnv resolves.
 */

import { useMemo, useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Star } from 'lucide-react';
import {
  listModelsAdminFn,
  setModelEnabledFn,
  setDefaultModelFn,
  reprobeModelsFn,
} from '~/server/function/models-admin.server';
import type { AdminModelRow } from '~/server/models/registry';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Switch } from '~/components/ui/switch';

export const Route = createFileRoute('/admin/models')({
  loader: async () => ({ models: await listModelsAdminFn() }),
  component: AdminModelsPage,
});

const HEALTH_STYLE: Record<AdminModelRow['health'], string> = {
  healthy: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  unhealthy: 'bg-red-500/15 text-red-600 border-red-500/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};

function fmtWhen(d: Date | string | null): string {
  if (!d) return '从未';
  const t = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString();
}

function AdminModelsPage() {
  const { models } = Route.useLoaderData();
  const router = useRouter();
  const setEnabled = useServerFn(setModelEnabledFn);
  const setDefault = useServerFn(setDefaultModelFn);
  const reprobe = useServerFn(reprobeModelsFn);
  const [busy, setBusy] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; baseUrl: string; authStyle: string; tokenEnv: string; tokenResolved: boolean; items: AdminModelRow[] }>();
    for (const m of models) {
      const g = map.get(m.connectionId) ?? {
        label: m.connectionLabel, baseUrl: m.baseUrl, authStyle: m.authStyle, tokenEnv: m.tokenEnv, tokenResolved: m.tokenResolved, items: [],
      };
      g.items.push(m);
      map.set(m.connectionId, g);
    }
    return [...map.values()];
  }, [models]);

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    try {
      await fn();
      await router.invalidate();
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">模型与健康（多模型）</h1>
          <p className="text-sm text-muted-foreground">来源/model id 在 <code>OXY_MODELS_SEED</code>(.env) 配置；这里看健康度并启用/停用、设默认、重测。</p>
        </div>
        <Button variant="outline" size="sm" disabled={busy === 'all'} onClick={() => run('all', () => reprobe({ data: {} }), '已触发全部重测')}>
          {busy === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          全部重测
        </Button>
      </div>

      {models.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          暂无模型。在 <code>.env</code> 配置 <code>OXY_MODELS_SEED</code> 后重启，或检查种子是否写入。
        </div>
      )}

      {groups.map((g) => (
        <div key={g.label} className="mb-6 rounded-lg border">
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs">
            <span className="font-semibold text-foreground">{g.label}</span>
            <span className="text-muted-foreground">{g.baseUrl}</span>
            <Badge variant="outline">{g.authStyle}</Badge>
            <Badge variant="outline" className={g.tokenResolved ? 'text-emerald-600' : 'text-red-600'}>
              {g.tokenEnv}{g.tokenResolved ? ' ✓' : ' ✗未配置'}
            </Badge>
          </div>
          <div className="divide-y">
            {g.items.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-40 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    {m.isDefault && <Badge className="gap-1"><Star className="h-3 w-3" />默认</Badge>}
                    {m.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{m.model}</div>
                </div>

                <div className="min-w-44 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className={HEALTH_STYLE[m.health]}>{m.health}</Badge>
                  {m.probeError && <span className="ml-1 text-red-600">{m.probeError}</span>}
                  <div className="mt-0.5">探活: {fmtWhen(m.lastProbeAt)}{m.latencyMs != null ? ` · ${m.latencyMs}ms` : ''}</div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch
                      checked={m.enabled}
                      disabled={busy === m.id}
                      onCheckedChange={(v) => run(m.id, () => setEnabled({ data: { id: m.id, enabled: v } }), v ? '已启用' : '已停用')}
                    />
                    启用
                  </label>
                  <Button variant="ghost" size="sm" disabled={busy === m.id || m.isDefault}
                    onClick={() => run(m.id, () => setDefault({ data: { id: m.id } }), '已设为默认')}>
                    设默认
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy === m.id}
                    onClick={() => run(m.id, () => reprobe({ data: { modelId: m.id } }), '已触发重测')}>
                    {busy === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
