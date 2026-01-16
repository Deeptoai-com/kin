import { FC } from 'react';
import type { ExtendedMcpInfo } from '~/claude/mcp';
import { McpCard } from './mcp-card';

interface McpGridProps {
  mcps: ExtendedMcpInfo[];
  enabledMcps: string[];
  verifyingSlug: string | null;
  onToggleMcp: (slug: string) => void;
  onViewDetails: (slug: string) => void;
  onVerifyMcp: (slug: string) => void;
}

export const McpGrid: FC<McpGridProps> = ({
  mcps,
  enabledMcps,
  verifyingSlug,
  onToggleMcp,
  onViewDetails,
  onVerifyMcp,
}) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {mcps.map((mcp) => (
        <McpCard
          key={mcp.slug}
          mcp={mcp}
          isEnabled={enabledMcps.includes(mcp.slug)}
          onToggle={() => onToggleMcp(mcp.slug)}
          onViewDetails={() => onViewDetails(mcp.slug)}
          onVerify={() => onVerifyMcp(mcp.slug)}
          verifying={verifyingSlug === mcp.slug}
        />
      ))}
    </div>
  );
};
