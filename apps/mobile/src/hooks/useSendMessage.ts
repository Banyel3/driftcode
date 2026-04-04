/**
 * useSendMessage
 *
 * TanStack Query mutation that calls POST /session/:id/prompt_async.
 *
 * The response body is empty (void) — the AI reply streams back through the
 * SSE event stream and is patched into the query cache by useMessages.
 *
 * Usage:
 *   const { send, isSending, cancel } = useSendMessage(sessionId);
 *   send('explain this file');
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import {
  sendMessageAsync,
  createOpenCodeClient,
} from '@driftcode/opencode-client';
import type { Message } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';
import { messageKeys } from './useMessages';

export interface UseSendMessageResult {
  /** Send a text message.  Returns a promise that resolves once the fire-and-forget
   *  POST completes (the AI reply streams in separately via SSE). */
  send: (text: string) => void;
  isSending: boolean;
  /** Abort the current pending send (cancels the POST, not the AI generation). */
  cancel: () => void;
  error: Error | null;
}

export function useSendMessage(
  sessionId: string | null,
): UseSendMessageResult {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const { mutate, isPending, error } = useMutation<void, Error, string>({
    mutationFn: async (text: string) => {
      if (!sessionId || !serverUrl || !serverPassword) {
        throw new Error('No active session or server connection');
      }

      abortRef.current = new AbortController();

      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });

      // Optimistically add the user message to the cache so the UI reflects it
      // immediately without waiting for the SSE echo.
      const optimisticMessage: Message = {
        id: `optimistic-${Date.now()}`,
        role: 'user',
        parts: [{ type: 'text', text }],
        createdAt: Date.now(),
      };

      queryClient.setQueryData<Message[]>(
        messageKeys.session(sessionId),
        (prev) => [...(prev ?? []), optimisticMessage],
      );

      await sendMessageAsync(client, sessionId, {
        parts: [{ type: 'text', text }],
      });
    },
    onError: (_err, _text) => {
      // Roll back optimistic message on failure.
      if (sessionId) {
        queryClient.setQueryData<Message[]>(
          messageKeys.session(sessionId),
          (prev) =>
            (prev ?? []).filter((m) => !m.id.startsWith('optimistic-')),
        );
      }
    },
  });

  return {
    send: (text: string) => {
      if (text.trim()) mutate(text.trim());
    },
    isSending: isPending,
    cancel: () => abortRef.current?.abort(),
    error: error ?? null,
  };
}
