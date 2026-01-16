import { FC, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Circle, Code, Database, Plug, Search } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { useServerFn } from '@tanstack/react-start';
import {
  disableMcpServerFn,
  enableMcpServerFn,
  getMcpDetailFn,
  verifyMcpServerFn,
} from '~/server/function/mcp.server';
import type { ExtendedMcpInfo, McpDetail } from '~/claude/mcp';
import { McpSidebar } from './mcp-sidebar';
import { McpGrid } from './mcp-grid';
import { McpDetailDialog } from './mcp-detail-dialog';

interface CategoryItem {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
}

const CATEGORIES: CategoryItem[] = [
  { id: 'all', label: 'All MCPs', icon: Plug },
  { id: 'development', label: 'Development', icon: Code },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'installed', label: 'Enabled', icon: CheckCircle },
];

export const McpPageComponent: FC<{
  mcps: ExtendedMcpInfo[];
  enabledMcps: string[];
}> = ({ mcps, enabledMcps: initialEnabled }) => {
  const enableMcp = useServerFn(enableMcpServerFn);
  const disableMcp = useServerFn(disableMcpServerFn);
  const verifyMcp = useServerFn(verifyMcpServerFn);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [enabledMcps, setEnabledMcps] = useState<string[]>(() => initialEnabled);
  const [verifyingSlug, setVerifyingSlug] = useState<string | null>(null);

  const { data: detail } = useQuery({
    queryKey: ['mcp-detail', selectedSlug],
    queryFn: async () => {
      if (!selectedSlug) return null;
      return await getMcpDetailFn({ data: { slug: selectedSlug } });
    },
    enabled: !!selectedSlug && isDetailOpen,
  });

  const handleToggleMcp = async (slug: string) => {
    const isEnabled = enabledMcps.includes(slug);
    try {
      if (isEnabled) {
        await disableMcp({ data: { slug } });
      } else {
        await enableMcp({ data: { slug } });
      }
      setEnabledMcps((prev) =>
        isEnabled ? prev.filter((item) => item !== slug) : [...prev, slug]
      );
    } catch (error) {
      console.error('Failed to toggle MCP:', error);
    }
  };

  const handleViewDetails = (slug: string) => {
    setSelectedSlug(slug);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedSlug(null);
  };

  const handleVerify = async (slug: string) => {
    try {
      setVerifyingSlug(slug);
      const result = await verifyMcp({ data: { slug } });
      if (result.ok) {
        alert('MCP verified successfully.');
      } else {
        const detail = result.message
          || (result.details ? JSON.stringify(result.details, null, 2) : '')
          || result.stderr
          || '';
        alert(`MCP verification failed. ${detail}`.trim());
      }
    } catch (error) {
      console.error('Failed to verify MCP:', error);
      alert('MCP verification failed.');
    } finally {
      setVerifyingSlug(null);
    }
  };

  const filteredMcps = useMemo(() => {
    let result = mcps;

    if (activeFilter === 'installed') {
      result = result.filter((mcp) => enabledMcps.includes(mcp.slug));
    } else if (activeFilter !== 'all') {
      result = result.filter((mcp) => mcp.category === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (mcp) =>
          mcp.name.toLowerCase().includes(query) ||
          (mcp.description && mcp.description.toLowerCase().includes(query))
      );
    }

    return result;
  }, [mcps, activeFilter, searchQuery, enabledMcps]);

  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return mcps.length;
    if (categoryId === 'installed') return enabledMcps.length;
    return mcps.filter((mcp) => mcp.category === categoryId).length;
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))]">
      <McpSidebar
        categories={CATEGORIES}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        getCategoryCount={getCategoryCount}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            {activeFilter === 'all'
              ? 'All MCPs'
              : CATEGORIES.find((c) => c.id === activeFilter)?.label || 'MCPs'}
            <span className="ml-2 text-muted-foreground">• {filteredMcps.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search MCPs..."
                className="w-64 pl-9"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {filteredMcps.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Circle className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No MCP servers found</p>
                <p className="text-sm text-muted-foreground/70">
                  Try adjusting your search or filter
                </p>
              </div>
            </div>
          ) : (
            <McpGrid
              mcps={filteredMcps}
              enabledMcps={enabledMcps}
              verifyingSlug={verifyingSlug}
              onToggleMcp={handleToggleMcp}
              onViewDetails={handleViewDetails}
              onVerifyMcp={handleVerify}
            />
          )}
        </div>
      </main>

      <McpDetailDialog
        mcp={detail as McpDetail | null}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
      />
    </div>
  );
};
