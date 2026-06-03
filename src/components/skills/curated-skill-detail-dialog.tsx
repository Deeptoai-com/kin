import { FC, ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import ReactMarkdown from 'react-markdown';
import { markdownComponents, markdownRemarkPlugins } from '~/components/claude-chat/markdown-components';
import { Loader2, ExternalLink, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
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
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import {
  getCuratedSkillDetailFn,
  getCuratedSkillSchemaFn,
  generateCuratedSkillSchemaFn,
} from '~/server/function/skills.server';

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
  const getSchema = useServerFn(getCuratedSkillSchemaFn);
  const genSchema = useServerFn(generateCuratedSkillSchemaFn);
  const [generating, setGenerating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['curated-skill-detail', slug],
    queryFn: async () => {
      if (!slug) return null;
      return await getDetail({ data: { slug } });
    },
    enabled: !!slug && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: schema, refetch: refetchSchema } = useQuery({
    queryKey: ['curated-skill-schema', slug],
    queryFn: async () => {
      if (!slug) return null;
      return await getSchema({ data: { slug } });
    },
    enabled: !!slug && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const c = content.curated;
  const d = c.detail;
  const sc = c.schema;

  const handleGenerateSchema = async (force = false) => {
    if (!slug) return;
    setGenerating(true);
    try {
      await genSchema({ data: { slug, force } });
      await refetchSchema();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : toLocalizedString(sc.failed));
    } finally {
      setGenerating(false);
    }
  };

  const schemaInputs = (schema?.schema?.inputs ?? []) as Array<{
    name: string;
    label?: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
  const hasSchema = schema?.status === 'valid' || schema?.status === 'needs_review' || schema?.status === 'stale';

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

          {/* Fillable-variable schema (S2.2) */}
          <div className="mt-6 border-t pt-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">{sc.heading}</p>
              {schema?.status === 'stale' && (
                <Badge variant="outline" className="text-[10px]">{sc.stale}</Badge>
              )}
              {schema?.status === 'needs_review' && (
                <Badge variant="outline" className="text-[10px]">{sc.needsReview}</Badge>
              )}
            </div>

            {hasSchema ? (
              <>
                {schemaInputs.length > 0 ? (
                  <div className="space-y-2">
                    {schemaInputs.map((field) => (
                      <div key={field.name} className="rounded-md border bg-muted/30 p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{field.label || field.name}</span>
                          <Badge variant="secondary" className="text-[10px]">{field.type}</Badge>
                          {field.required && (
                            <span className="text-[10px] text-destructive">{sc.required}</span>
                          )}
                        </div>
                        {field.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{field.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{sc.noInputs}</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 gap-1 px-2 text-xs"
                  disabled={generating}
                  onClick={() => handleGenerateSchema(true)}
                >
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {generating ? sc.generating : sc.regenerate}
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {schema?.status === 'failed' ? sc.failed : sc.none}
                </p>
                <p className="text-[11px] text-muted-foreground/70">{sc.costNote}</p>
                <Button
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={generating || data?.contentStatus === 'no_upstream'}
                  onClick={() => handleGenerateSchema(false)}
                >
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {generating ? sc.generating : sc.generate}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
