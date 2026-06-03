import { FC, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import ReactMarkdown from 'react-markdown';
import { markdownComponents, markdownRemarkPlugins } from '~/components/claude-chat/markdown-components';
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Badge } from '~/components/ui/badge';
import { ScrollArea } from '~/components/ui/scroll-area';
import { getCuratedSkillDetailFn } from '~/server/function/skills.server';

/**
 * Curated Skill Detail Dialog (Skills S1b) — read-only.
 *
 * Lazily fetches a curated skill's editorial fields + SKILL.md content
 * (cache-first from skill_content_cache, else fetched from skills-api and
 * cached server-side). No enable/run yet (S2).
 */
export const CuratedSkillDetailDialog: FC<{
  slug: string | null;
  isOpen: boolean;
  onClose: () => void;
}> = ({ slug, isOpen, onClose }) => {
  const content = useIntlayer('skills');
  const getDetail = useServerFn(getCuratedSkillDetailFn);

  const { data, isLoading } = useQuery({
    queryKey: ['curated-skill-detail', slug],
    queryFn: async () => {
      if (!slug) return null;
      return await getDetail({ data: { slug } });
    },
    enabled: !!slug && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const c = content.curated;
  const d = c.detail;

  const editorialBlocks: Array<{ label: ReactNode; value: string | null }> = data
    ? [
        { label: d.suitableFor, value: data.suitableForZh },
        { label: d.problem, value: data.problemZh },
        { label: d.firstTask, value: data.firstTaskZh },
        { label: d.riskNotes, value: data.riskNotesZh },
      ]
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl leading-none" aria-hidden>
              {data?.iconEmoji || '🧩'}
            </span>
            <span>{data?.titleZh || data?.name || slug}</span>
            {data?.level && (
              <Badge variant="outline" className="text-[10px]">
                {data.level}
              </Badge>
            )}
          </DialogTitle>
          {data?.summaryZh && <DialogDescription>{data.summaryZh}</DialogDescription>}
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {/* Meta row */}
          {data && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {data.category && (
                <Badge variant="secondary" className="text-[10px]">
                  {data.category}
                </Badge>
              )}
              {data.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
              {data.githubUrl && (
                <a
                  href={data.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {data.sourceLabel || toLocalizedString(c.viewOnGithub)}
                </a>
              )}
            </div>
          )}

          {/* Editorial blocks */}
          {editorialBlocks.some((b) => b.value) && (
            <div className="mb-5 grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              {editorialBlocks
                .filter((b) => b.value)
                .map((b, i) => (
                  <div key={i}>
                    <p className="mb-0.5 text-xs font-medium text-muted-foreground">{b.label}</p>
                    <p className="text-sm">{b.value}</p>
                  </div>
                ))}
            </div>
          )}

          {/* SKILL.md content */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{d.instructions}</p>
            {isLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {d.loading}
              </div>
            ) : data?.instructions ? (
              <div className="space-y-2 text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={markdownRemarkPlugins} components={markdownComponents}>
                  {data.instructions}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                {data?.contentStatus === 'no_upstream' ? d.noUpstream : d.contentUnavailable}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
