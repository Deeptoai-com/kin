/**
 * Workbench selectors — Phase 3 Wave 1.
 *
 * Derives the right-side workbench's live data from the chat session store.
 * The store only ever holds the CURRENT session's messages (it is replaced on
 * session switch), so everything here is inherently scoped to the active
 * session — no cross-session bleed. Server-side user scoping is enforced when
 * messages are loaded; this layer adds no new data access.
 */

import { useMemo } from 'react';
import { useChatSessionStore, type ThreadMessage } from '~/lib/chat-session-store';

export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoItem {
  content: string;
  status: TodoStatus;
  /** Present-tense form Claude Code emits (e.g. "Reading file"); optional. */
  activeForm?: string;
}

export interface TodoSummary {
  todos: TodoItem[];
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

const VALID_STATUS: Record<string, TodoStatus> = {
  pending: 'pending',
  in_progress: 'in_progress',
  completed: 'completed',
};

function coerceTodos(raw: unknown): TodoItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: TodoItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const content = typeof e.content === 'string' ? e.content : '';
    if (!content) continue;
    const status = VALID_STATUS[String(e.status)] ?? 'pending';
    const activeForm = typeof e.activeForm === 'string' ? e.activeForm : undefined;
    items.push({ content, status, activeForm });
  }
  return items.length > 0 ? items : null;
}

/**
 * The most recent TodoWrite call's list in the current session. TodoWrite is
 * called repeatedly with the full updated list, so the latest call IS the
 * current plan. Returns null when the agent hasn't produced a plan yet.
 */
export function selectLatestTodos(messages: ThreadMessage[]): TodoItem[] | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i].content;
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j];
      if (part.type === 'tool-call' && part.toolName?.toLowerCase() === 'todowrite') {
        const todos = coerceTodos((part.args as Record<string, unknown> | undefined)?.todos);
        if (todos) return todos;
      }
    }
  }
  return null;
}

export function useSessionTodos(): TodoSummary | null {
  const messages = useChatSessionStore((s) => s.messages);
  return useMemo(() => {
    const todos = selectLatestTodos(messages);
    if (!todos) return null;
    return {
      todos,
      total: todos.length,
      completed: todos.filter((t) => t.status === 'completed').length,
      inProgress: todos.filter((t) => t.status === 'in_progress').length,
      pending: todos.filter((t) => t.status === 'pending').length,
    };
  }, [messages]);
}
