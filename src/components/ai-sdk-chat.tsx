'use client';

/**
 * AI SDK Chat Surface with Mastra Memory Support
 *
 * Implementation based on ui-dojo (Mastra + Vercel AI SDK + UI Elements)
 * Adapted for OxyGenie with TanStack Router and GLM-5.0
 * Now supports:
 * - Multiple agents with thread-based conversations
 * - Session sidebar for managing threads
 * - Mastra Memory for conversation persistence
 */

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '~/components/ai-elements/conversation';
import { Message, MessageContent } from '~/components/ai-elements/message';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  type PromptInputMessage,
} from '~/components/ai-elements/prompt-input';
import { Action, Actions } from '~/components/ai-elements/actions';
import { Fragment, useEffect, useState, useRef } from 'react';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import { useChat } from '@ai-sdk/react';
import { Response } from '~/components/ai-elements/response';
import { CopyIcon, RefreshCcwIcon, Bot } from 'lucide-react';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '~/components/ai-elements/sources';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '~/components/ai-elements/reasoning';
import { Loader } from '~/components/ai-elements/loader';
import { SessionSidebar } from '~/components/ai-elements/session-sidebar';
import { NewSessionModal } from '~/components/ai-elements/new-session-modal';

// Available agents configuration
const AGENTS = {
  'assistant-agent': {
    id: 'assistant-agent',
    name: '通用助手',
    icon: '💬',
    description: 'AI 助手，可以回答问题、帮助分析',
  },
  'translator-agent': {
    id: 'translator-agent',
    name: '语言炼金师',
    icon: '🎭',
    description: '追求翻译的最高境界，灵魂的重生',
  },
} as const;

const suggestions = [
  'What can you help me with?',
  'Read the README.md file',
  'Summarize the project structure',
  'Explain a technical concept',
];

export function AISdkChat() {
  const content = useIntlayer('ai-elements');
  const [input, setInput] = useState('');
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string>('assistant-agent');
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  // Flag to skip loading messages when auto-creating a session
  // This prevents the race condition where loadThreadMessages overwrites the first message
  const skipNextLoadRef = useRef(false);

  const { messages, sendMessage, status, regenerate, setMessages } = useChat({
    api: '/api/chat',
  });

  // Load thread messages when thread changes
  useEffect(() => {
    if (currentThreadId) {
      // Skip loading if we just auto-created this session (first message is being sent)
      if (skipNextLoadRef.current) {
        skipNextLoadRef.current = false;
        return;
      }
      loadThreadMessages(currentThreadId);
    }
  }, [currentThreadId]);

  const loadThreadMessages = async (threadId: string) => {
    try {
      const response = await fetch(`/api/threads/${threadId}`);
      if (response.ok) {
        const data = await response.json();
        // Update messages from thread
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('[AISdkChat] Failed to load thread:', error);
    }
  };

  /**
   * Create a new session/thread.
   * Returns the new threadId if successful, null otherwise.
   * @param clearMessages - Whether to clear messages after creation (default: true).
   *                        Set to false when auto-creating during first message send
   *                        to avoid race condition with sendMessage.
   */
  const handleCreateSession = async (
    agentId: string,
    title?: string,
    clearMessages: boolean = true
  ): Promise<string | null> => {
    try {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, title }),
      });

      if (response.ok) {
        const data = await response.json();
        const newThreadId = data.thread.threadId;
        // When auto-creating (clearMessages=false), skip the next loadThreadMessages
        // to prevent overwriting the first message that's about to be sent
        if (!clearMessages) {
          skipNextLoadRef.current = true;
        }
        setCurrentThreadId(newThreadId);
        setCurrentAgentId(data.thread.agentId);
        // Only clear messages when explicitly requested (e.g., from NewSessionModal)
        if (clearMessages) {
          setMessages([]);
        }
        // Trigger sidebar refresh to show new thread
        setSidebarRefreshTrigger((prev) => prev + 1);
        return newThreadId;
      }
      return null;
    } catch (error) {
      console.error('[AISdkChat] Failed to create session:', error);
      return null;
    }
  };

  const handleThreadSelect = (threadId: string, agentId: string) => {
    setCurrentThreadId(threadId);
    setCurrentAgentId(agentId);
  };

  const handleNewThread = () => {
    setIsNewSessionModalOpen(true);
  };

  /**
   * Handle message submission.
   * If no thread exists, automatically create one first (like ChatGPT).
   */
  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    // Auto-create session if none exists (ChatGPT-like behavior)
    let threadId = currentThreadId;
    if (!threadId) {
      // Use first message as title hint (truncated)
      const titleHint = message.text?.slice(0, 50) || 'New Chat';
      // Pass clearMessages=false to avoid race condition with sendMessage
      threadId = await handleCreateSession(currentAgentId, titleHint, false);
      if (!threadId) {
        console.error('[AISdkChat] Failed to auto-create session');
        return;
      }
    }

    sendMessage(
      {
        text: message.text || 'Sent with attachments',
        files: message.files,
      },
      {
        // Pass agentId and threadId via request body
        body: {
          agentId: currentAgentId,
          threadId: threadId,
        },
      },
    );

    setInput('');
  };

  /**
   * Handle suggestion click - auto-creates session if needed.
   */
  const handleSuggestionClick = async (suggestion: string) => {
    // Auto-create session if none exists
    let threadId = currentThreadId;
    if (!threadId) {
      // Pass clearMessages=false to avoid race condition with sendMessage
      threadId = await handleCreateSession(currentAgentId, suggestion.slice(0, 50), false);
      if (!threadId) {
        console.error('[AISdkChat] Failed to auto-create session');
        return;
      }
    }

    sendMessage(
      { text: suggestion },
      {
        body: {
          agentId: currentAgentId,
          threadId: threadId,
        },
      },
    );
  };

  const currentAgent = AGENTS[currentAgentId as keyof typeof AGENTS];

  return (
    <div className="flex h-full">
      {/* Session Sidebar */}
      {isSidebarOpen && (
        <div className="w-64 border-r flex-shrink-0">
          <SessionSidebar
            currentThreadId={currentThreadId}
            onThreadSelect={handleThreadSelect}
            onNewThread={handleNewThread}
            refreshTrigger={sidebarRefreshTrigger}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header with toggle sidebar button */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          {currentAgent && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">{currentAgent.icon}</span>
              <span className="font-medium">{currentAgent.name}</span>
            </div>
          )}
          <div className="w-9" /> {/* Spacer for balance */}
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="h-full max-w-4xl mx-auto p-0 md:p-6 flex flex-col">
            <Conversation className="flex-1">
              <ConversationContent>
                {messages.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-center text-muted-foreground">
                    <div className="space-y-4">
                      <Bot className="mx-auto h-12 w-12" />
                      <h2 className="text-lg font-medium">
                        {currentAgent?.name || 'AI Assistant'}
                      </h2>
                      <p className="text-sm">
                        {currentAgent?.description ||
                          'Ask me anything. I can also read files from the workspace.'}
                      </p>
                      {!currentThreadId && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {toLocalizedString(content.chatSurface.startOrSelect)}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id}>
                      {message.role === 'assistant' &&
                        message.parts.filter((part) => part.type === 'source-url')
                          .length > 0 && (
                          <Sources>
                            <SourcesTrigger
                              count={
                                message.parts.filter(
                                  (part) => part.type === 'source-url',
                                ).length
                              }
                            />
                            {message.parts
                              .filter((part) => part.type === 'source-url')
                              .map((part, i) => (
                                <SourcesContent key={`${message.id}-${i}`}>
                                  <Source
                                    key={`${message.id}-${i}`}
                                    href={part.url}
                                    title={part.url}
                                  />
                                </SourcesContent>
                              ))}
                          </Sources>
                        )}
                      {message.parts.map((part, i) => {
                        switch (part.type) {
                          case 'text':
                            return (
                              <Fragment key={`${message.id}-${i}`}>
                                <Message from={message.role}>
                                  <MessageContent>
                                    <Response>{part.text}</Response>
                                  </MessageContent>
                                </Message>
                                {message.role === 'assistant' &&
                                  i === message.parts.length - 1 && (
                                    <Actions className="mt-2">
                                      <Action
                                        onClick={() => regenerate()}
                                        label={toLocalizedString(content.chatSurface.retry)}
                                      >
                                        <RefreshCcwIcon className="size-3" />
                                      </Action>
                                      <Action
                                        onClick={() =>
                                          navigator.clipboard.writeText(part.text)
                                        }
                                        label={toLocalizedString(content.chatSurface.copy)}
                                      >
                                        <CopyIcon className="size-3" />
                                      </Action>
                                    </Actions>
                                  )}
                              </Fragment>
                            );
                          case 'reasoning':
                            return (
                              <Reasoning
                                key={`${message.id}-${i}`}
                                className="w-full"
                                isStreaming={
                                  status === 'streaming' &&
                                  i === message.parts.length - 1 &&
                                  message.id === messages.at(-1)?.id
                                }
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>{part.text}</ReasoningContent>
                              </Reasoning>
                            );
                          default:
                            return null;
                        }
                      })}
                    </div>
                  ))
                )}
                {status === 'submitted' && <Loader />}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            {messages.length === 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1.5 text-sm bg-muted hover:bg-accent rounded-lg transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <PromptInput
              onSubmit={handleSubmit}
              className="mt-4"
              globalDrop
              multiple
            >
              <PromptInputBody>
                <PromptInputAttachments>
                  {(attachment) => <PromptInputAttachment data={attachment} />}
                </PromptInputAttachments>
                <PromptInputTextarea
                  onChange={(e) => setInput(e.target.value)}
                  value={input}
                  placeholder={toLocalizedString(content.chatSurface.typeYourMessage)}
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                </PromptInputTools>
                <PromptInputSubmit disabled={!input && status !== 'ready'} status={status} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>

      {/* New Session Modal */}
      <NewSessionModal
        open={isNewSessionModalOpen}
        onOpenChange={setIsNewSessionModalOpen}
        onCreateSession={handleCreateSession}
      />
    </div>
  );
}
