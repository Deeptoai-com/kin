/**
 * Context Badges Component
 *
 * Displays active Skills and MCP sources in the chat input area.
 * Skills are shown as a single trigger with a vertical list panel.
 */

import { type FC, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { getSkillSchemaFn, listAllSkillsFn } from '~/server/function/skills.server';
import type { SkillSchema } from '~/claude/skills';
import type { SessionMetadata, McpServerStatus } from './session-info-panel';

interface ContextBadgesProps {
  sessionMetadata: SessionMetadata | null;
  onExampleSelect?: (prompt: string) => void;
  onSkillsOpenChange?: (open: boolean) => void;
  hideSkillsTrigger?: boolean;
}

type SkillExample = { title?: string; prompt: string };
type SkillEntry = {
  slug: string;
  name: string;
  examples: SkillExample[];
};

/**
 * Extract display name from MCP server entry
 * Handles both string and McpServerStatus object formats
 */
function getMcpDisplayName(item: string | McpServerStatus): string {
  if (typeof item === 'string') return item;
  return item.name || 'unknown';
}

/**
 * Context Badges - Shows active Skills and MCP sources
 */
export const ContextBadges: FC<ContextBadgesProps> = ({
  sessionMetadata,
  onExampleSelect,
  onSkillsOpenChange,
  hideSkillsTrigger,
}) => {
  const [skillsOpen, setSkillsOpen] = useState(false);
  const listAllSkills = useServerFn(listAllSkillsFn);
  const getSkillSchema = useServerFn(getSkillSchemaFn);

  // Extract skills
  const skillSlugs = useMemo(() => {
    if (!sessionMetadata?.skills) return [];
    return Array.from(new Set(sessionMetadata.skills.filter(Boolean)));
  }, [sessionMetadata?.skills]);

  // Extract MCP servers
  const mcpServers = useMemo(() => {
    if (!sessionMetadata?.mcp_servers) return [];
    return sessionMetadata.mcp_servers
      .map(getMcpDisplayName)
      .filter(Boolean);
  }, [sessionMetadata?.mcp_servers]);

  const { data: skillCatalog } = useQuery({
    queryKey: ['skills-catalog'],
    queryFn: () => listAllSkills(),
    enabled: skillSlugs.length > 0,
    staleTime: 60_000,
  });

  const { data: skillSchemas, isLoading: isLoadingSchemas } = useQuery({
    queryKey: ['skills-schemas', skillSlugs],
    queryFn: async () => {
      const results = await Promise.all(
        skillSlugs.map(async (slug) => {
          try {
            const result = await getSkillSchema({ data: { skillSlug: slug } });
            return { slug, schema: (result?.schema ?? null) as SkillSchema | null };
          } catch {
            return { slug, schema: null };
          }
        })
      );
      return results;
    },
    enabled: skillSlugs.length > 0,
    staleTime: 60_000,
  });

  const skillNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!skillCatalog) return map;
    for (const skill of [...skillCatalog.official, ...skillCatalog.user]) {
      map.set(skill.slug, skill.name);
    }
    return map;
  }, [skillCatalog]);

  const schemaBySlug = useMemo(() => {
    const map = new Map<string, SkillSchema | null>();
    for (const item of skillSchemas ?? []) {
      map.set(item.slug, item.schema ?? null);
    }
    return map;
  }, [skillSchemas]);

  const skillEntries = useMemo<SkillEntry[]>(() => {
    return skillSlugs.map((slug) => {
      const schema = schemaBySlug.get(slug);
      const name = schema?.name || skillNameMap.get(slug) || slug;
      const examplesRaw = Array.isArray(schema?.examples) ? schema?.examples : [];
      const examples = examplesRaw
        .map((example) => {
          if (!example) return null;
          if (typeof example === 'string') {
            const prompt = example.trim();
            return prompt ? { prompt } : null;
          }
          if (typeof example === 'object') {
            const prompt = typeof example.prompt === 'string' ? example.prompt.trim() : '';
            if (!prompt) return null;
            const title = typeof example.title === 'string' ? example.title : undefined;
            return title ? { title, prompt } : { prompt };
          }
          return null;
        })
        .filter(Boolean) as SkillExample[];
      return { slug, name, examples };
    });
  }, [schemaBySlug, skillNameMap, skillSlugs]);

  useEffect(() => {
    onSkillsOpenChange?.(skillsOpen);
  }, [skillsOpen, onSkillsOpenChange]);

  useEffect(() => {
    if (hideSkillsTrigger && skillsOpen) {
      setSkillsOpen(false);
    }
  }, [hideSkillsTrigger, skillsOpen]);

  if (skillSlugs.length === 0 && mcpServers.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {skillSlugs.length > 0 && !hideSkillsTrigger && (
        <DropdownMenu open={skillsOpen} onOpenChange={setSkillsOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border bg-transparent px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="查看 Skills 示例"
            >
              Skills · {skillSlugs.length}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 p-2">
            <DropdownMenuLabel className="px-2 text-xs">Skills</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-64 overflow-y-auto">
              {isLoadingSchemas && (
                <div className="px-2 py-2 text-xs text-muted-foreground">正在加载示例...</div>
              )}
              {!isLoadingSchemas && skillEntries.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">暂无启用的 Skills</div>
              )}
              {skillEntries.map((skill) => (
                <div key={skill.slug} className="px-1 py-2">
                  <div className="px-2 text-xs font-medium text-foreground">{skill.name}</div>
                  {skill.examples.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {skill.examples.map((example, index) => (
                        <DropdownMenuItem
                          key={`${skill.slug}-${index}`}
                          onSelect={() => {
                            if (example.prompt) {
                              onExampleSelect?.(example.prompt);
                            }
                          }}
                          className="flex cursor-pointer flex-col items-start gap-0.5 text-xs"
                        >
                          <span className="font-medium">
                            {example.title ?? `示例 ${index + 1}`}
                          </span>
                          <span className="text-[11px] text-muted-foreground line-clamp-2">
                            {example.prompt}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 px-2 text-[11px] text-muted-foreground">暂无示例</div>
                  )}
                </div>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/agents/skills" className="w-full text-xs">
                打开 Skills Store
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {mcpServers.length > 0 && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help items-center rounded-full border bg-transparent px-2 py-0.5 text-xs text-muted-foreground">
                MCP · {mcpServers.length}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap text-xs">
              {mcpServers.join('\n')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

export default ContextBadges;
