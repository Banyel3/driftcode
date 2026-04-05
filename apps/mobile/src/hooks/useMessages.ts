/**
 * useMessages
 *
 * Fetches the message history for a session and keeps it fresh via the global
 * SSE event stream.  Uses TanStack Query for caching, background refetch, and
 * loading/error states.
 *
 * Strategy:
 *  1. On mount, fetch the full message list (GET /session/:id/message).
 *  2. Listen on the SSE stream for `message.updated` / `message.deleted`
 *     events and apply them as optimistic cache patches — no full refetch
 *     needed during streaming.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { getMessages, createOpenCodeClient } from '@driftcode/opencode-client';
import type { Message, MessagePart, ToolInvocationPart, TextPart, OpenCodeEvent } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';
import { useSSEStream } from './useSSEStream';

function toMessageKey(msg: Message, fallbackIndex: number): string {
  if (typeof msg.id === 'string' && msg.id.trim().length > 0) {
    return msg.id;
  }

  const firstPart = msg.parts[0];
  const seed =
    firstPart?.type === 'text'
      ? (firstPart as TextPart).text.slice(0, 24)
      : firstPart?.type ?? 'none';

  return `synthetic-${msg.role}-${msg.createdAt}-${seed}-${fallbackIndex}`;
}

function normalizeMessages(messages: Message[]): Message[] {
  if (messages.length <= 1) return messages;
  const deduped = new Map<string, Message>();
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    const id = toMessageKey(msg, i);
    deduped.set(id, { ...msg, id });
  }
  return Array.from(deduped.values()).sort((a, b) => a.createdAt - b.createdAt);
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const messageKeys = {
  all: ['messages'] as const,
  session: (sessionId: string) => ['messages', sessionId] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export interface UseMessagesResult {
  messages: Message[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** True while the AI is actively generating (last assistant message has no
   *  text part with a non-empty string yet, or we received a partial tool call). */
  isStreaming: boolean;
}

export function useMessages(sessionId: string | null): UseMessagesResult {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const queryClient = useQueryClient();

  // ── 1. Fetch initial message list ─────────────────────────────────────────
  const { data, isLoading, isError, error } = useQuery<Message[], Error>({
    queryKey: messageKeys.session(sessionId ?? ''),
    enabled: sessionId !== null && serverUrl !== null && serverPassword !== null,
    queryFn: async () => {
      if (!sessionId || !serverUrl || !serverPassword) return [];
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      const raw = await getMessages(client, sessionId);
      const serverMessages = Array.isArray(raw) ? raw : [];

      // Keep local optimistic user messages visible across refetches until
      // the authoritative SSE user echo arrives and replaces them.
      const cached = queryClient.getQueryData<Message[]>(messageKeys.session(sessionId)) ?? [];
      const optimistic = cached.filter((m) => m.id.startsWith('optimistic-'));

      return normalizeMessages([...serverMessages, ...optimistic]);
    },
    // Don't auto-refetch on window focus — SSE keeps us up-to-date.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // ── 2. SSE patch — keep the ref stable across renders ─────────────────────
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const handleEvent = useCallback(
    (event: OpenCodeEvent) => {
      if (event.type === 'message.updated') {
        const { sessionId: evtSession, message } = event.properties;
        if (evtSession !== sessionIdRef.current) return;

        queryClient.setQueryData<Message[]>(
          messageKeys.session(evtSession),
          (prev) => {
            const list = prev ?? [];
            // When the real user message arrives via SSE, strip any optimistic
            // placeholder we added in useSendMessage — prevents duplicate display.
            const base =
              message.role === 'user'
                ? list.filter((m) => !m.id.startsWith('optimistic-'))
                : list;
            const idx = base.findIndex((m) => m.id === message.id);
            if (idx === -1) return normalizeMessages([...base, message]);
            const next = [...base];
            next[idx] = message;
            return normalizeMessages(next);
          },
        );
      }

      if (event.type === 'message.deleted') {
        const { sessionId: evtSession, messageId } = event.properties;
        if (evtSession !== sessionIdRef.current) return;

        queryClient.setQueryData<Message[]>(
          messageKeys.session(evtSession),
          (prev) => normalizeMessages((prev ?? []).filter((m) => m.id !== messageId)),
        );
      }
    },
    [queryClient],
  );

  useSSEStream({
    enabled: sessionId !== null,
    onEvent: handleEvent,
    onReconnect: () => {
      if (!sessionIdRef.current) return;
      void queryClient.invalidateQueries({
        queryKey: messageKeys.session(sessionIdRef.current),
      });
    },
  });

  // ── 3. Derive isStreaming ──────────────────────────────────────────────────
  const messages = data ?? [];
  const lastMsg = messages.at(-1);

  // isStreaming is true while the last assistant message is still being built:
  //   a) it has no text part with any content yet (tokens haven't arrived), OR
  //   b) it has a tool-invocation that hasn't received a result yet.
  // Using both conditions prevents premature dismissal of the typing indicator
  // during pure-tool-call steps and fixes the "trivially true" case where
  // every() passes vacuously when there are no text parts at all.
  const hasPartialToolCall =
    lastMsg?.parts.some(
      (p: MessagePart) =>
        p.type === 'tool-invocation' &&
        (p as ToolInvocationPart).toolInvocation.state !== 'result',
    ) ?? false;

  const hasNoText =
    (lastMsg?.parts.every(
      (p: MessagePart) =>
        p.type !== 'text' ||
        (p.type === 'text' && (p as TextPart).text === ''),
    ) ??
      true) && (lastMsg?.parts.length ?? 0) > 0;

  const isStreaming =
    lastMsg?.role === 'assistant' && (hasNoText || hasPartialToolCall);

  return {
    messages,
    isLoading,
    isError,
    error,
    isStreaming,
  };
}
