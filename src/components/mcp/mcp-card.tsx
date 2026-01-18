import { FC } from 'react';
import { CheckCircle, Circle, Eye, ShieldCheck, Trash2, User, Globe, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import type { ExtendedMcpInfo } from '~/claude/mcp';

interface McpCardProps {
  mcp: ExtendedMcpInfo;
  isEnabled: boolean;
  onToggle: () => void;
  onViewDetails: () => void;
  onVerify: () => void;
  onDelete?: () => void;
  verifying?: boolean;
  deleting?: boolean;
}

export const McpCard: FC<McpCardProps> = ({
  mcp,
  isEnabled,
  onToggle,
  onViewDetails,
  onVerify,
  onDelete,
  verifying,
  deleting,
}) => {
  // Determine if this is a custom MCP (system or personal)
  const isCustom = mcp.store === 'system' || mcp.store === 'user';
  const isSystem = mcp.store === 'system';
  const isPersonal = mcp.store === 'user';

  return (
    <div className="group relative rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{mcp.name}</h3>
            {isEnabled ? (
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            {isSystem && (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                <Globe className="mr-1 h-3 w-3" />
                System
              </Badge>
            )}
            {isPersonal && (
              <Badge variant="secondary" className="text-xs">
                <User className="mr-1 h-3 w-3" />
                Personal
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground capitalize">
            {mcp.category}
          </p>
        </div>
      </div>

      {mcp.description && (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
          {mcp.description}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button
          variant={isEnabled ? 'outline' : 'default'}
          size="sm"
          onClick={onToggle}
          className="flex-1"
        >
          {isEnabled ? 'Disable' : 'Enable'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewDetails}
          className="shrink-0"
          title="View details"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onVerify}
          className="shrink-0"
          title="Verify MCP"
          disabled={verifying}
        >
          {verifying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
        </Button>
        {isCustom && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="shrink-0 text-destructive hover:text-destructive"
            title="Delete MCP"
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
