import { createFileRoute } from '@tanstack/react-router';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import { listAllMcpsFn } from '~/server/function/mcp.server';
import { McpPageComponent } from '~/components/mcp/mcp-page';
import type { ExtendedMcpInfo } from '~/claude/mcp';

export const Route = createFileRoute('/agents/mcp')({
  loader: async () => {
    const result = await listAllMcpsFn();
    // Defensive: ensure arrays are never undefined
    const official = result.official || [];
    const system = result.system || [];
    const user = result.user || [];
    const allMcps: ExtendedMcpInfo[] = [
      ...official,
      ...system,
      ...user,
    ];

    return {
      officialMcps: official,
      systemMcps: system,
      userMcps: user,
      allMcps,
    };
  },
  component: () => {
    const content = useIntlayer('mcp');
    const { officialMcps, systemMcps, userMcps, allMcps } = Route.useLoaderData();
    const enabledMcps = allMcps.filter((mcp) => mcp.enabled).map((mcp) => mcp.slug);
    const customCount = systemMcps.length + userMcps.length;

    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{content.header.title}</h1>
            <p className="text-sm text-muted-foreground">
              {toLocalizedString(content.header.description).replace('{total}', String(allMcps.length)).replace('{custom}', String(customCount))}
            </p>
          </div>
        </div>

        <McpPageComponent
          mcps={officialMcps}
          systemMcps={systemMcps}
          userMcps={userMcps}
          enabledMcps={enabledMcps}
        />
      </div>
    );
  },
});
