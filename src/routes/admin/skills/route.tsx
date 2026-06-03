/**
 * Admin · Skills governance
 *
 * Lists ALL users' upstream-added skills (scope='user') and lets an admin
 * remove any of them — the governance guardrail for the S3 "add from upstream"
 * feature. Admin access is enforced by the parent /admin route loader
 * (requireSystemAdmin) and again by the server functions (requireAdmin).
 */

import { useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { ExternalLink, Trash2, Loader2 } from 'lucide-react';
import {
  listAllUserAddedSkillsFn,
  adminRemoveUserAddedSkillFn,
} from '~/server/function/skills.server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';

export const Route = createFileRoute('/admin/skills')({
  loader: async () => {
    const skills = await listAllUserAddedSkillsFn();
    return { skills };
  },
  component: AdminSkillsPage,
});

function AdminSkillsPage() {
  const { skills } = Route.useLoaderData();
  const router = useRouter();
  const removeFn = useServerFn(adminRemoveUserAddedSkillFn);
  const [removing, setRemoving] = useState<string | null>(null);

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}"? This deletes the user's added skill (cascade: content, schema, enablement).`)) {
      return;
    }
    setRemoving(id);
    try {
      await removeFn({ data: { id } });
      toast.success('Removed');
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold">User-added skills</h2>
        <p className="text-sm text-muted-foreground">
          Upstream skills that users pulled into their own catalog. Remove any that shouldn't be available.
        </p>
      </div>

      {skills.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">No user-added skills.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skill</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Upstream</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skills.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.slug}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{s.ownerName || '—'}</div>
                    <div className="text-xs text-muted-foreground">{s.ownerEmail || s.ownerUserId}</div>
                  </TableCell>
                  <TableCell>
                    {s.upstream ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        {s.upstream.owner}/{s.upstream.repo}/{s.upstream.skillId}
                        {s.githubUrl && (
                          <a href={s.githubUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">—</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive"
                      disabled={removing === s.id}
                      onClick={() => handleRemove(s.id, s.name)}
                    >
                      {removing === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
