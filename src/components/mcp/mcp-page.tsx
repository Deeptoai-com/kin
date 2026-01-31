import { FC, useMemo, useState, useCallback } from 'react';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Circle, Code, Database, Plug, Search, Plus, User, Globe } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { useServerFn } from '@tanstack/react-start';
import {
  disableMcpServerFn,
  enableMcpServerFn,
  getMcpDetailFn,
  verifyMcpServerFn,
  deleteCustomMcpFn,
  listAllMcpsFn,
} from '~/server/function/mcp.server';
import type { ExtendedMcpInfo, McpDetail } from '~/claude/mcp';
import { McpSidebar } from './mcp-sidebar';
import { McpGrid } from './mcp-grid';
import { McpDetailDialog } from './mcp-detail-dialog';
import { AddCustomMcpDialog } from './add-custom-mcp-dialog';

interface CategoryItem {
  id: string;
  labelKey: string;
  icon: FC<{ className?: string }>;
}

// Define categories with label keys for i18n
const CATEGORIES_BASE: Omit<CategoryItem, 'label'>[] = [
  { id: 'all', labelKey: 'categories.all', icon: Plug },
  { id: 'development', labelKey: 'categories.development', icon: Code },
  { id: 'data', labelKey: 'categories.data', icon: Database },
  { id: 'installed', labelKey: 'categories.installed', icon: CheckCircle },
  { id: 'system', labelKey: 'categories.system', icon: Globe },
  { id: 'custom', labelKey: 'categories.custom', icon: User },
];

export const McpPageComponent: FC<{
  mcps: ExtendedMcpInfo[];
  systemMcps: ExtendedMcpInfo[];
  userMcps: ExtendedMcpInfo[];
  enabledMcps: string[];
}> = ({ mcps: initialMcps, systemMcps: initialSystemMcps, userMcps: initialUserMcps, enabledMcps: initialEnabled }) => {
  const content = useIntlayer('mcp');
  const queryClient = useQueryClient();
  const enableMcp = useServerFn(enableMcpServerFn);
  const disableMcp = useServerFn(disableMcpServerFn);
  const verifyMcp = useServerFn(verifyMcpServerFn);
  const deleteCustomMcp = useServerFn(deleteCustomMcpFn);

  // Build categories with translated labels
  const CATEGORIES = useMemo(() => {
    return CATEGORIES_BASE.map((cat) => ({
      ...cat,
      // Access nested property like content.sidebar.categories.all
      label: (content.sidebar.categories as Record<string, string>)[cat.id] || cat.id,
    }));
  }, [content]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [mcps, setMcps] = useState<ExtendedMcpInfo[]>(() => initialMcps || []);
  const [systemMcps, setSystemMcps] = useState<ExtendedMcpInfo[]>(() => initialSystemMcps || []);
  const [userMcps, setUserMcps] = useState<ExtendedMcpInfo[]>(() => initialUserMcps || []);
  const [enabledMcps, setEnabledMcps] = useState<string[]>(() => initialEnabled || []);
  const [verifyingSlug, setVerifyingSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  // Combine official, system, and user MCPs
  const allMcps = useMemo(() => [...mcps, ...systemMcps, ...userMcps], [mcps, systemMcps, userMcps]);

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
        alert(toLocalizedString(content.verify.success));
      } else {
        const detail = result.message
          || (result.details ? JSON.stringify(result.details, null, 2) : '')
          || result.stderr
          || '';
        alert(`${toLocalizedString(content.verify.failed)} ${detail}`.trim());
      }
    } catch (error) {
      console.error('Failed to verify MCP:', error);
      alert(toLocalizedString(content.verify.genericFailed));
    } finally {
      setVerifyingSlug(null);
    }
  };

  const handleDeleteCustomMcp = async (slug: string) => {
    // Find the MCP to determine its store type
    const mcp = allMcps.find((m) => m.slug === slug);
    const storeType = mcp?.store;
    const isSystemMcp = storeType === 'system';

    const confirmMsg = isSystemMcp
      ? toLocalizedString(content.deleteConfirm.system).replace('{slug}', slug)
      : toLocalizedString(content.deleteConfirm.personal).replace('{slug}', slug);

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setDeletingSlug(slug);
      const result = await deleteCustomMcp({ data: { slug, scope: isSystemMcp ? 'system' : 'personal' } });
      if (result.ok) {
        if (isSystemMcp) {
          setSystemMcps((prev) => prev.filter((mcp) => mcp.slug !== slug));
        } else {
          setUserMcps((prev) => prev.filter((mcp) => mcp.slug !== slug));
        }
        setEnabledMcps((prev) => prev.filter((s) => s !== slug));
      } else {
        alert(result.error || toLocalizedString(content.delete.failed));
      }
    } catch (error) {
      console.error('Failed to delete MCP:', error);
      alert(toLocalizedString(content.delete.failed));
    } finally {
      setDeletingSlug(null);
    }
  };

  const handleAddSuccess = useCallback(async () => {
    // Refresh MCP list
    try {
      const result = await listAllMcpsFn();
      setMcps(result.official);
      setSystemMcps(result.system);
      setUserMcps(result.user);
    } catch (error) {
      console.error('Failed to refresh MCP list:', error);
    }
  }, []);

  const filteredMcps = useMemo(() => {
    let result = allMcps;

    if (activeFilter === 'installed') {
      result = result.filter((mcp) => enabledMcps.includes(mcp.slug));
    } else if (activeFilter === 'system') {
      result = systemMcps;
    } else if (activeFilter === 'custom') {
      result = userMcps;
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
  }, [allMcps, systemMcps, userMcps, activeFilter, searchQuery, enabledMcps]);

  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return allMcps.length;
    if (categoryId === 'installed') return enabledMcps.length;
    if (categoryId === 'system') return systemMcps.length;
    if (categoryId === 'custom') return userMcps.length;
    return allMcps.filter((mcp) => mcp.category === categoryId).length;
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
              ? content.sidebar.categories.all
              : (content.sidebar.categories as Record<string, string>)[activeFilter] || 'MCPs'}
            <span className="ml-2 text-muted-foreground">• {filteredMcps.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={toLocalizedString(content.page.searchPlaceholder)}
                className="w-64 pl-9"
              />
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {content.page.addMcpButton}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {filteredMcps.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Circle className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">{content.page.noResults}</p>
                <p className="text-sm text-muted-foreground/70">
                  {content.page.noResultsHint}
                </p>
              </div>
            </div>
          ) : (
            <McpGrid
              mcps={filteredMcps}
              enabledMcps={enabledMcps}
              verifyingSlug={verifyingSlug}
              deletingSlug={deletingSlug}
              onToggleMcp={handleToggleMcp}
              onViewDetails={handleViewDetails}
              onVerifyMcp={handleVerify}
              onDeleteMcp={handleDeleteCustomMcp}
            />
          )}
        </div>
      </main>

      <McpDetailDialog
        mcp={detail as McpDetail | null}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        onToggle={(slug, enabled) => {
          setEnabledMcps((prev) =>
            enabled ? [...prev.filter((s) => s !== slug), slug] : prev.filter((s) => s !== slug)
          );
        }}
      />

      <AddCustomMcpDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
};
