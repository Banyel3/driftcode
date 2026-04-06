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
  OpenCodeAPIError,
} from '@driftcode/opencode-client';
import type { Message } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';
import { messageKeys } from './useMessages';

const SEND_RECONCILE_DELAY_MS = 2_000;
const SEND_FALLBACK_REFETCH_MS = 7_000;

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
  const runtimeControls = useConnectionStore((s) =>
    sessionId ? s.sessionRuntimeControls[sessionId] : undefined,
  );

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
        ...(runtimeControls?.agent ? { agent: runtimeControls.agent } : {}),
        ...(runtimeControls?.model ? { model: runtimeControls.model } : {}),
        ...(runtimeControls?.variant ? { variant: runtimeControls.variant } : {}),
      });

      // If SSE delivery is delayed/dropped by network middleboxes, this keeps
      // chat state eventually consistent without requiring manual refresh.
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: messageKeys.session(sessionId) });
      }, SEND_FALLBACK_REFETCH_MS);
    },
    onError: (_err, _text) => {
      const err = _err;

      // Auth/validation failures are definitive; rollback immediately.
      if (err instanceof OpenCodeAPIError && err.status >= 400 && err.status < 500) {
        if (sessionId) {
          queryClient.setQueryData<Message[]>(
            messageKeys.session(sessionId),
            (prev) =>
              (prev ?? []).filter((m) => !m.id.startsWith('optimistic-')),
          );
        }
        return;
      }

      // For timeout/network failures we may not know whether the server accepted
      // the prompt. Delay cleanup briefly and refetch to reconcile with source
      // of truth before removing optimistic placeholders.
      if (!sessionId) return;
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: messageKeys.session(sessionId) });
      }, SEND_RECONCILE_DELAY_MS);

      // Roll back optimistic placeholders after reconciliation window.
      if (sessionId) {
        setTimeout(() => {
          queryClient.setQueryData<Message[]>(
            messageKeys.session(sessionId),
            (prev) =>
              (prev ?? []).filter((m) => !m.id.startsWith('optimistic-')),
          );
        }, SEND_RECONCILE_DELAY_MS + 2_000);
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
