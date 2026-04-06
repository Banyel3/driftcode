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

function messageTimestamp(msg: Message): number {
  const createdAt = (msg as { createdAt?: unknown }).createdAt;
  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) {
    return createdAt;
  }

  const timeCreated = (msg as { time?: { created?: unknown } }).time?.created;
  if (typeof timeCreated === 'number' && Number.isFinite(timeCreated)) {
    return timeCreated;
  }

  return 0;
}

function normalizeMessage(msg: Message): Message {
  const ts = messageTimestamp(msg);
  return {
    ...msg,
    createdAt: ts,
  };
}

function toMessageKey(msg: Message, fallbackIndex: number): string {
  if (typeof msg.id === 'string' && msg.id.trim().length > 0) {
    return msg.id;
  }

  const firstPart = msg.parts[0];
  const seed =
    firstPart?.type === 'text'
      ? (firstPart as TextPart).text.slice(0, 24)
      : firstPart?.type ?? 'none';

  return `synthetic-${msg.role}-${messageTimestamp(msg)}-${seed}-${fallbackIndex}`;
}

function normalizeMessages(messages: Message[]): Message[] {
  if (messages.length <= 1) return messages.map(normalizeMessage);
  const deduped = new Map<string, Message>();
  for (let i = 0; i < messages.length; i += 1) {
    const msg = normalizeMessage(messages[i]);
    const id = toMessageKey(msg, i);
    deduped.set(id, { ...msg, id });
  }
  return Array.from(deduped.values()).sort((a, b) => {
    const ts = messageTimestamp(a) - messageTimestamp(b);
    if (ts !== 0) return ts;
    return a.id.localeCompare(b.id);
  });
}

function readMessageUpdatedPayload(event: OpenCodeEvent): { sessionId: string; message: Message } | null {
  if (event.type !== 'message.updated') return null;

  const props = (event as { properties?: unknown }).properties;
  if (!props || typeof props !== 'object') return null;

  const typed = props as {
    sessionId?: unknown;
    sessionID?: unknown;
    message?: unknown;
    info?: unknown;
  };

  const messageCandidate = typed.message ?? typed.info;
  const sessionFromMessage =
    messageCandidate && typeof messageCandidate === 'object'
      ? (messageCandidate as { sessionId?: unknown; sessionID?: unknown }).sessionId ??
        (messageCandidate as { sessionId?: unknown; sessionID?: unknown }).sessionID
      : undefined;

  const sessionIdCandidate = typed.sessionId ?? typed.sessionID ?? sessionFromMessage;

  if (typeof sessionIdCandidate !== 'string' || !messageCandidate || typeof messageCandidate !== 'object') {
    return null;
  }

  return {
    sessionId: sessionIdCandidate,
    message: normalizeMessage(messageCandidate as Message),
  };
}

function readMessageDeletedPayload(event: OpenCodeEvent): { sessionId: string; messageId: string } | null {
  if (event.type !== 'message.deleted' && event.type !== 'message.removed') return null;

  const props = (event as { properties?: unknown }).properties;
  if (!props || typeof props !== 'object') return null;

  const typed = props as {
    sessionId?: unknown;
    sessionID?: unknown;
    messageId?: unknown;
    messageID?: unknown;
    info?: {
      sessionID?: unknown;
      messageID?: unknown;
    };
  };

  const sessionIdCandidate = typed.sessionId ?? typed.sessionID ?? typed.info?.sessionID;
  const messageIdCandidate = typed.messageId ?? typed.messageID ?? typed.info?.messageID;

  if (typeof sessionIdCandidate !== 'string' || typeof messageIdCandidate !== 'string') {
    return null;
  }

  return {
    sessionId: sessionIdCandidate,
    messageId: messageIdCandidate,
  };
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
      const updatedPayload = readMessageUpdatedPayload(event);
      if (updatedPayload) {
        const { sessionId: evtSession, message } = updatedPayload;
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

      const deletedPayload = readMessageDeletedPayload(event);
      if (deletedPayload) {
        const { sessionId: evtSession, messageId } = deletedPayload;
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

  const assistantStreaming =
    lastMsg?.role === 'assistant' && (hasNoText || hasPartialToolCall);

  const awaitingAssistant =
    lastMsg?.role === 'user' && Date.now() - messageTimestamp(lastMsg) < 120_000;

  const isStreaming = assistantStreaming || awaitingAssistant;

  return {
    messages,
    isLoading,
    isError,
    error,
    isStreaming,
  };
}
