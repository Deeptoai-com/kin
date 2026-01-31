'use client';

/**
 * Session Sidebar Component
 *
 * Displays list of chat threads/sessions for the current user.
 * Supports creating new sessions and switching between existing ones.
 */

import { useEffect, useState } from 'react';
import { useIntlayer } from 'react-intlayer';
import { PlusIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';

// Types for thread data
export interface Thread {
  threadId: string;
  agentId: string;
  title: string;
  updatedAt: string;
  agent?: {
    id: string;
    name: string;
    icon: string;
    description: string;
  };
}

interface SessionSidebarProps {
  currentThreadId?: string | null;
  onThreadSelect: (threadId: string, agentId: string) => void;
  onNewThread: () => void;
  className?: string;
  /** Increment this to trigger a refresh of the thread list */
  refreshTrigger?: number;
}

export function SessionSidebar({
  currentThreadId,
  onThreadSelect,
  onNewThread,
  className,
  refreshTrigger,
}: SessionSidebarProps) {
  const content = useIntlayer('ai-elements');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  // Load threads from API on mount and when refreshTrigger changes
  useEffect(() => {
    loadThreads();
  }, [refreshTrigger]);

  const loadThreads = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/threads');
      if (response.ok) {
        const data = await response.json();
        setThreads(data.threads || []);
      }
    } catch (error) {
      console.error('[SessionSidebar] Failed to load threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleThreadClick = (thread: Thread) => {
    onThreadSelect(thread.threadId, thread.agentId);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-muted/30', className)}>
      {/* Header - height aligned with main chat header (px-4 py-2) */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h2 className="font-semibold text-sm">{content.sessionSidebar.title}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onNewThread}
        >
          <PlusIcon className="h-4 w-4" />
          <span className="sr-only">{content.sessionSidebar.newSession}</span>
        </Button>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            // Loading skeleton
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </>
          ) : threads.length === 0 ? (
            // Empty state
            <div className="p-4 text-center text-sm text-muted-foreground">
              <p>{content.sessionSidebar.noSessionsYet}</p>
              <p className="text-xs mt-1">{content.sessionSidebar.clickToCreate}</p>
            </div>
          ) : (
            // Thread list
            threads.map((thread) => (
              <button
                key={thread.threadId}
                onClick={() => handleThreadClick(thread)}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-colors hover:bg-accent',
                  'flex items-start gap-3',
                  currentThreadId === thread.threadId && 'bg-accent'
                )}
              >
                {/* Agent Icon */}
                <span className="text-xl flex-shrink-0 mt-0.5">
                  {thread.agent?.icon || '💬'}
                </span>

                {/* Thread Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {thread.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {thread.agent?.name} • {formatDate(thread.updatedAt)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
