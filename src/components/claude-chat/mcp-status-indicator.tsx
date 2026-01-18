/**
 * MCP Status Indicator Component
 *
 * Displays real-time MCP server connection status in the chat header.
 * Shows status indicators (connected/failed/pending) with tooltips.
 */

import type { FC } from 'react';
import { useChatSessionStore } from '~/lib/chat-session-store';

export interface McpServerStatus {
  name: string;
  status: 'connected' | 'failed' | 'pending';
  error?: string;
  tool_count?: number;
}

interface McpStatusIndicatorProps {
  className?: string;
}

export const McpStatusIndicator: FC<McpStatusIndicatorProps> = ({ className = '' }) => {
  const sessionMetadata = useChatSessionStore((state) => state.sessionMetadata);
  const mcpServers = sessionMetadata?.mcp_servers;

  if (!mcpServers || mcpServers.length === 0) {
    return null;
  }

  // Count by status
  let connected = 0;
  let failed = 0;
  let pending = 0;

  const servers: McpServerStatus[] = mcpServers.map((s) => {
    if (typeof s === 'string') {
      return { name: s, status: 'pending' as const };
    }
    return s;
  });

  for (const s of servers) {
    if (s.status === 'connected') connected++;
    else if (s.status === 'failed') failed++;
    else if (s.status === 'pending') pending++;
  }

  // Overall status
  const overallStatus = failed > 0 ? 'failed' :
    pending > 0 && connected === 0 ? 'pending' :
    'connected';

  const statusColor = overallStatus === 'connected' ? 'text-green-500' :
    overallStatus === 'failed' ? 'text-red-500' :
    'text-yellow-500';

  const statusIcon = overallStatus === 'connected' ? '●' :
    overallStatus === 'failed' ? '●' :
    '○';

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <span className={`${statusColor} ${overallStatus === 'pending' ? 'animate-pulse' : ''}`} title="MCP Server Status">
        {statusIcon} MCP
      </span>
      <span className="text-[#6b6a68] dark:text-[#9a9893]">
        {connected > 0 && <span className="text-green-500">{connected}</span>}
        {failed > 0 && <span className="text-red-500"> +{failed}</span>}
        {pending > 0 && <span className="text-yellow-500"> +{pending}</span>}
      </span>
    </div>
  );
};

interface McpStatusPopoverProps {
  className?: string;
}

/**
 * Expanded MCP status display with all servers listed
 */
export const McpStatusPopover: FC<McpStatusPopoverProps> = ({ className = '' }) => {
  const sessionMetadata = useChatSessionStore((state) => state.sessionMetadata);
  const mcpServers = sessionMetadata?.mcp_servers;

  if (!mcpServers || mcpServers.length === 0) {
    return null;
  }

  const servers: McpServerStatus[] = mcpServers.map((s) => {
    if (typeof s === 'string') {
      return { name: s, status: 'pending' as const };
    }
    return s;
  });

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {servers.map((server) => {
        const statusIndicator = server.status === 'connected' ? '🟢' :
          server.status === 'failed' ? '🔴' :
          server.status === 'pending' ? '🟡' : '⚪';

        const toolCount = server.tool_count !== undefined
          ? ` (${server.tool_count} tools)`
          : '';

        const errorSuffix = server.error
          ? ` - ${server.error}`
          : '';

        return (
          <div key={server.name} className="flex items-center gap-1.5 text-xs text-[#6b6a68] dark:text-[#9a9893]">
            <span>{statusIndicator}</span>
            <span>{server.name}</span>
            <span className="text-[#8a8985]">{toolCount}</span>
            {server.error && (
              <span className="text-red-500" title={server.error}>⚠️</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
