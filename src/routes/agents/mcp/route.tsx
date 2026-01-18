import { createFileRoute } from '@tanstack/react-router';
import { listAllMcpsFn } from '~/server/function/mcp.server';
import { McpPageComponent } from '~/components/mcp/mcp-page';
import type { ExtendedMcpInfo } from '~/claude/mcp';

export const Route = createFileRoute('/agents/mcp')({
  loader: async () => {
    const result = await listAllMcpsFn();
    const allMcps: ExtendedMcpInfo[] = [
      ...result.official,
      ...result.system,
      ...result.user,
    ];

    return {
      officialMcps: result.official,
      systemMcps: result.system,
      userMcps: result.user,
      allMcps,
    };
  },
  component: () => {
    const { officialMcps, systemMcps, userMcps, allMcps } = Route.useLoaderData();
    const enabledMcps = allMcps.filter((mcp) => mcp.enabled).map((mcp) => mcp.slug);
    const customCount = systemMcps.length + userMcps.length;

    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">MCP Store</h1>
            <p className="text-sm text-muted-foreground">
              Manage MCP servers ({allMcps.length} total, {customCount} custom)
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
