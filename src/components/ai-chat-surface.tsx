'use client';

/**
 * AI SDK Chat Surface Component
 *
 * Client-only component for AI chat functionality.
 * Separated to avoid SSR issues with useChat hook.
 */

import { useChat } from '@ai-sdk/react';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '~/components/ai-elements/conversation';
import { Message, MessageContent } from '~/components/ai-elements/message';
import { Response } from '~/components/ai-elements/response';
import { Loader } from '~/components/ai-elements/loader';
import { Bot } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useState, Fragment, useEffect } from 'react';

export function AIChatSurface() {
  const content = useIntlayer('ai-elements');
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);

  const { messages, sendMessage, status } = useChat({
    api: '/api/chat',
  });

  // Ensure we only render on client
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Bot className="h-12 w-12 animate-pulse" />
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input || !input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="flex h-full flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-center text-muted-foreground">
              <div className="space-y-2">
                <Bot className="mx-auto h-12 w-12" />
                <p className="text-sm">{toLocalizedString(content.chatSurface.startConversation)}</p>
                <p className="text-xs">{toLocalizedString(content.chatSurface.askAnything)}</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id}>
                {message.parts?.map((part, i) => {
                  if (part.type === 'text') {
                    return (
                      <Fragment key={`${message.id}-${i}`}>
                        <Message from={message.role}>
                          <MessageContent>
                            <Response>{String(part.text ?? '')}</Response>
                          </MessageContent>
                        </Message>
                      </Fragment>
                    );
                  }
                  return null;
                })}
              </div>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Composer */}
      <div className="mt-4 rounded-lg border bg-background p-2">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={toLocalizedString(content.chatSurface.typeYourMessage)}
              className="w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-0"
              disabled={status !== 'ready'}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={status !== 'ready' || !input?.trim()}
          >
            {toLocalizedString(content.chatSurface.send)}
          </Button>
        </form>
      </div>

      {status === 'submitted' && <Loader />}
    </div>
  );
}
