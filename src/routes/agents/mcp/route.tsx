import { createFileRoute } from '@tanstack/react-router';
import { listAllMcpsFn } from '~/server/function/mcp.server';
import { McpPageComponent } from '~/components/mcp/mcp-page';
import type { ExtendedMcpInfo } from '~/claude/mcp';

export const Route = createFileRoute('/agents/mcp')({
  loader: async () => {
    const result = await listAllMcpsFn();
    const allMcps: ExtendedMcpInfo[] = [
      ...result.official,
      ...result.user,
    ];

    return { allMcps };
  },
  component: () => {
    const { allMcps } = Route.useLoaderData();
    const enabledMcps = allMcps.filter((mcp) => mcp.enabled).map((mcp) => mcp.slug);

    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">MCP Store</h1>
            <p className="text-sm text-muted-foreground">
              Manage MCP servers ({allMcps.length} total)
            </p>
          </div>
        </div>

        <McpPageComponent mcps={allMcps} enabledMcps={enabledMcps} />
      </div>
    );
  },
});
