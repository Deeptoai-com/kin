import { FC, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Search, Plus, Check, Loader2, ExternalLink, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  searchUpstreamSkillsFn,
  addUpstreamSkillFn,
  type UpstreamSearchItem,
} from '~/server/function/skills.server';

/**
 * Upstream Search Dialog (Skills S3) — search the skills-api registry and add a
 * skill to the user's catalog. Added skills then install/detail/schema like any
 * catalog skill. See PRD §9 S3.
 */
export const UpstreamSearchDialog: FC<{
  isOpen: boolean;
  onClose: () => void;
  /** Called when at least one skill was added (parent can refresh). */
  onAdded?: () => void;
}> = ({ isOpen, onClose, onAdded }) => {
  const content = useIntlayer('skills');
  const u = content.curated.upstream;
  const search = useServerFn(searchUpstreamSkillsFn);
  const addSkill = useServerFn(addUpstreamSkillFn);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UpstreamSearchItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const [addedAny, setAddedAny] = useState(false);

  const runSearch = async (nextPage = 1) => {
    setLoading(true);
    try {
      const res = await search({ data: { query, page: nextPage } });
      setItems(res.items);
      setTotalPages(res.totalPages);
      setPage(res.page);
      setSearched(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (item: UpstreamSearchItem) => {
    setAddingSlug(item.slug);
    try {
      const res = await addSkill({
        data: { owner: item.owner, repo: item.repo, skillId: item.skillId, name: item.displayName, githubUrl: item.githubUrl },
      });
      if (res.reason === 'exists_official') {
        toast.info(toLocalizedString(u.existsOfficialToast));
        setItems((prev) => prev.map((it) => (it.slug === item.slug ? { ...it, status: 'official' } : it)));
      } else {
        toast.success(toLocalizedString(u.addedToast));
        setAddedAny(true);
        setItems((prev) => prev.map((it) => (it.slug === item.slug ? { ...it, status: 'added' } : it)));
      }
    } catch (error) {
      toast.error(`${toLocalizedString(u.addFailed)}${error instanceof Error ? `: ${error.message}` : ''}`);
    } finally {
      setAddingSlug(null);
    }
  };

  const handleClose = () => {
    if (addedAny) onAdded?.();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{u.title}</DialogTitle>
          <DialogDescription>{u.description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(1);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={toLocalizedString(u.searchPlaceholder)}
              className="pl-9"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : u.search}
          </Button>
        </form>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {searched && items.length === 0 && !loading && (
            <p className="py-8 text-center text-sm text-muted-foreground">{u.empty}</p>
          )}
          {items.map((item) => (
            <div key={`${item.source}/${item.skillId}`} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{item.displayName || item.name}</span>
                  {item.isOfficial && (
                    <Badge variant="secondary" className="text-[10px]">{u.official}</Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{item.owner}/{item.repo}</span>
                  <span>·</span>
                  <span>{toLocalizedString(u.installs).replace('{count}', String(item.installs))}</span>
                  {item.githubUrl && (
                    <a
                      href={item.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              {item.status === 'official' ? (
                <Badge variant="outline" className="gap-1 text-[10px]"><Lock className="h-3 w-3" />{u.inLibrary}</Badge>
              ) : item.status === 'added' ? (
                <Badge variant="outline" className="gap-1 text-[10px]"><Check className="h-3 w-3" />{u.added}</Badge>
              ) : (
                <Button size="sm" className="h-7 gap-1 px-2 text-xs" disabled={addingSlug === item.slug} onClick={() => handleAdd(item)}>
                  {addingSlug === item.slug ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  {addingSlug === item.slug ? u.adding : u.add}
                </Button>
              )}
            </div>
          ))}
        </div>

        {searched && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => runSearch(page - 1)}>
              {u.prev}
            </Button>
            <span className="text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => runSearch(page + 1)}>
              {u.next}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
