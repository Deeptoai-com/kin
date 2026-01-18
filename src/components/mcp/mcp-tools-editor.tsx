/**
 * MCP Tools Editor Component
 *
 * Visual editor for managing MCP tool permissions.
 * Displays all available tools for an MCP with checkboxes to allow/deny.
 */

import { type FC, useState, useEffect } from 'react';
import { Loader2Icon, RefreshCwIcon, CheckIcon } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { getAllowedToolsOverrideFn, setAllowedToolsOverrideFn, getMcpToolsFn, listMcpStore } from '~/server/function/mcp.server';

interface McpTool {
  name: string;
  description: string;
  fullName: string;
}

interface McpToolsEditorProps {
  slug: string;
}

interface ToolState {
  tool: McpTool;
  allowed: boolean;
  isOverride: boolean;
}

export const McpToolsEditor: FC<McpToolsEditorProps> = ({ slug }) => {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [toolStates, setToolStates] = useState<ToolState[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasOverride, setHasOverride] = useState(false);

  const getMcpTools = useServerFn(getMcpToolsFn);
  const getAllowedToolsOverride = useServerFn(getAllowedToolsOverrideFn);
  const setAllowedToolsOverride = useServerFn(setAllowedToolsOverrideFn);
  const getMcpStore = useServerFn(listMcpStore);

  // Load tools on mount
  useEffect(() => {
    loadTools();
  }, [slug]);

  const loadTools = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get MCP info for default allowedTools
      const mcpStoreResult = await getMcpStore({});
      if (!mcpStoreResult.data) {
        setError('Failed to load MCP info');
        return;
      }

      const mcpStore = mcpStoreResult.data as Array<{ allowedTools?: string[] }>;
      const mcpInfo = mcpStore.find((m) => m.slug === slug);
      const defaultAllowedTools = mcpInfo?.allowedTools || null;

      // Fetch tool list from MCP
      const toolsResult = await getMcpToolsFn({ data: { slug } });
      if (!toolsResult.data?.ok) {
        setError(toolsResult.data?.error || 'Failed to load tools');
        setTools([]);
        setToolStates([]);
        return;
      }

      const fetchedTools = toolsResult.data.tools || [];
      setTools(fetchedTools);

      // Get user override
      const overrideResult = await getAllowedToolsOverrideFn({ data: { slug } });
      const userOverride = overrideResult.data?.allowedTools;

      // Determine allowed state
      const defaultSet = new Set(defaultAllowedTools || []);
      const overrideSet = userOverride ? new Set(userOverride) : null;

      setToolStates(fetchedTools.map((tool) => {
        const isOverride = overrideSet ? overrideSet.has(tool.fullName) : false;
        const allowed = isOverride || (!userOverride && defaultSet.has(tool.fullName));
        return {
          tool,
          allowed,
          isOverride: !!userOverride,
        };
      }));

      setHasOverride(!!userOverride);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTools();
    setRefreshing(false);
  };

  const handleToggle = (fullName: string) => {
    setToolStates((prev) =>
      prev.map((state) =>
        state.tool.fullName === fullName
          ? { ...state, allowed: !state.allowed, isOverride: true }
          : state
      )
    );
    setHasOverride(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const allowedTools = toolStates
        .filter((s) => s.allowed)
        .map((s) => s.tool.fullName);

      await setAllowedToolsOverrideFn({
        data: { slug, allowedTools },
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);

    try {
      await setAllowedToolsOverrideFn({
        data: { slug, allowedTools: null },
      });

      // Get default allowedTools
      const mcpStoreResult = await getMcpStore({});
      const mcpStore = mcpStoreResult.data as Array<{ allowedTools?: string[] }>;
      const mcpInfo = mcpStore.find((m) => m.slug === slug);
      const defaultAllowedTools = mcpInfo?.allowedTools || null;

      // Reset to default state
      const defaultSet = new Set(defaultAllowedTools || []);
      setToolStates((prev) =>
        prev.map((state) => ({
          ...state,
          allowed: defaultSet.has(state.tool.fullName),
          isOverride: false,
        }))
      );

      setHasOverride(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setSaving(false);
    }
  };

  // Get stats
  const totalTools = toolStates.length;
  const allowedCount = toolStates.filter((s) => s.allowed).length;
  const overrideCount = toolStates.filter((s) => s.isOverride && s.allowed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[#6b6a68] dark:text-[#9a9893]">
        <Loader2Icon className="h-5 w-5 animate-spin" />
        <span className="ml-2">Loading tools...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
        <p className="font-medium">Error loading tools</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 rounded border border-red-300 bg-red-100 px-2 py-1 text-sm text-red-700 hover:bg-red-200 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="text-center py-8 text-[#8a8985] italic dark:text-[#b8b5a9]">
        No tools available for this MCP server.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with stats and actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#6b6a68] dark:text-[#9a9893]">
          {totalTools} tools · <span className="text-green-600 dark:text-green-400">{allowedCount} allowed</span>
          {hasOverride && (
            <span className="text-blue-600 dark:text-blue-400"> · {overrideCount} custom</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded p-1 text-[#6b6a68] transition-colors hover:bg-[#e5e4df] dark:text-[#9a9893] dark:hover:bg-[#3a3938] disabled:opacity-50"
          title="Refresh tool list"
        >
          <RefreshCwIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tool list */}
      <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-[#e5e4df] bg-[#fafaf9] dark:border-[#3a3938] dark:bg-[#1f1e1b]">
        {toolStates.map(({ tool, allowed, isOverride }) => (
          <label
            key={tool.fullName}
            className={`flex items-start gap-2 px-3 py-2 hover:bg-[#f5f5f4] dark:hover:bg-[#2a2928] cursor-pointer ${
              isOverride ? 'bg-blue-50 dark:bg-blue-950/20' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={allowed}
              onChange={() => handleToggle(tool.fullName)}
              className="mt-0.5 h-4 w-4 rounded border-[#a8a295] text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-[#1a1a18] dark:text-[#eee]">
                  {tool.name}
                </span>
                {isOverride && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    custom
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6b6a68] dark:text-[#9a9893] line-clamp-1">
                {tool.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[#e5e4df] dark:border-[#3a3938]">
        {hasOverride && (
          <button
            onClick={handleReset}
            disabled={saving}
            className="text-sm text-[#6b6a68] transition-colors hover:text-[#1a1a18] dark:text-[#9a9893] dark:hover:text-[#eee] disabled:opacity-50"
          >
            Reset to Default
          </button>
        )}

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center text-sm text-green-600 dark:text-green-400">
              <CheckIcon className="h-4 w-4" />
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
