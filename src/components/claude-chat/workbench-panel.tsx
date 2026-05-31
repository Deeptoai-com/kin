/**
 * WorkbenchPanel — Phase 3 Wave 0 skeleton (right-side resident workbench).
 *
 * The "agent workbench" rail that turns the chat from a chat-box into a
 * workbench: switchable sections (Progress / Sub-agents / Files / Context).
 *
 * Wave 0 scope: STRUCTURE ONLY. Every section renders an empty state with a
 * placeholder 3D-icon slot. No data wiring yet — each section is filled in a
 * later wave:
 *   · Progress    → ① TodoWrite live checklist          (Wave 1)
 *   · Sub-agents  → ② nested tree via parent_tool_use_id (Wave 1)
 *   · Files       → existing session-files / artifacts    (Wave 1)
 *   · Context     → ⑤ memory + Phase 2 usage_record       (Wave 2/3)
 *
 * Multi-tenant boundary: takes `currentSessionId` so future data reads are
 * scoped per session (and, server-side, per user). Holds no cross-session state.
 *
 * i18n: labels are intentionally hardcoded (English) for the skeleton; they get
 * moved into intlayer content when the sections are actually wired up.
 */

import { useState, type FC, type ReactNode } from 'react';
import { ListChecks, GitBranch, FolderOpen, Gauge } from 'lucide-react';
import { cn } from '~/lib/utils';

type WorkbenchTab = 'progress' | 'subagents' | 'files' | 'context';

interface TabDef {
  id: WorkbenchTab;
  label: string;
  icon: typeof ListChecks;
}

const TABS: TabDef[] = [
  { id: 'progress', label: 'Progress', icon: ListChecks },
  { id: 'subagents', label: 'Sub-agents', icon: GitBranch },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'context', label: 'Context', icon: Gauge },
];

/** Placeholder slot for the owner-supplied 3D skeuomorphic icons (Wave 0). */
const IconSlot: FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      'flex items-center justify-center rounded-xl border border-dashed border-border',
      'bg-gradient-to-b from-accent/60 to-transparent text-[9px] font-medium text-muted-foreground',
      className,
    )}
    aria-hidden
  >
    3D
  </div>
);

const EmptyState: FC<{ title: string; hint: string; children?: ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
    <IconSlot className="h-12 w-12" />
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
    {children}
  </div>
);

export interface WorkbenchPanelProps {
  currentSessionId: string | null;
  className?: string;
}

export const WorkbenchPanel: FC<WorkbenchPanelProps> = ({ currentSessionId, className }) => {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('progress');

  return (
    <aside
      className={cn('flex h-full w-full flex-col bg-card', className)}
      aria-label="Agent workbench"
    >
      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-border px-2 pt-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-1.5 rounded-t-md px-2.5 py-2 text-xs font-medium transition-colors',
                'border-b-2 -mb-px',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Section body — Wave 0 empty states */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'progress' && (
          <EmptyState
            title="No active plan"
            hint="The agent's TodoWrite plan will appear here, with steps checked off live as the task runs."
          />
        )}
        {activeTab === 'subagents' && (
          <EmptyState
            title="No sub-agents yet"
            hint="When the agent spawns sub-agents, they'll show here as a nested tree with live status."
          />
        )}
        {activeTab === 'files' && (
          <EmptyState
            title="No files yet"
            hint="Files and artifacts produced in this session's workspace will be listed here."
          />
        )}
        {activeTab === 'context' && (
          <EmptyState
            title="Context & usage"
            hint="Session memory, connectors, and this month's token usage will surface here."
          />
        )}
      </div>

      {/* Session-scope footer marker (skeleton — confirms per-session boundary) */}
      <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
        {currentSessionId ? (
          <span>Session · {currentSessionId.slice(0, 8)}</span>
        ) : (
          <span>No active session</span>
        )}
      </div>
    </aside>
  );
};

export default WorkbenchPanel;
