import { FC } from 'react';
import type { ExtendedMcpInfo } from '~/claude/mcp';
import { McpCard } from './mcp-card';

interface McpGridProps {
  mcps: ExtendedMcpInfo[];
  enabledMcps: string[];
  verifyingSlug: string | null;
  deletingSlug?: string | null;
  onToggleMcp: (slug: string) => void;
  onViewDetails: (slug: string) => void;
  onVerifyMcp: (slug: string) => void;
  onDeleteMcp?: (slug: string) => void;
}

export const McpGrid: FC<McpGridProps> = ({
  mcps,
  enabledMcps,
  verifyingSlug,
  deletingSlug,
  onToggleMcp,
  onViewDetails,
  onVerifyMcp,
  onDeleteMcp,
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
          onDelete={onDeleteMcp ? () => onDeleteMcp(mcp.slug) : undefined}
          verifying={verifyingSlug === mcp.slug}
          deleting={deletingSlug === mcp.slug}
        />
      ))}
    </div>
  );
};
