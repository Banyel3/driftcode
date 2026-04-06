/**
 * useMessages
 *
 * Fetches and normalizes session messages, then keeps cache in sync via SSE.
 * Supports both legacy and MessageV2 payload shapes used by opencode.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import {
  getMessages,
  createOpenCodeClient,
  normalizeIncomingMessage,
  normalizeIncomingPart,
} from '@driftcode/opencode-client';
import type {
  Message,
  MessagePart,
  OpenCodeEvent,
  TextPart,
  ToolInvocationPart,
} from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';
import { useSSEStream } from './useSSEStream';

function messageTimestamp(message: Message): number {
  return typeof message.createdAt === 'number' && Number.isFinite(message.createdAt)
    ? message.createdAt
    : 0;
}

function sortMessages(messages: Message[]): Message[] {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const ts = messageTimestamp(a.message) - messageTimestamp(b.message);
      if (ts !== 0) return ts;
      return a.index - b.index;
    })
    .map(({ message }) => message);
}

function dedupeAndSort(messages: Message[]): Message[] {
  const seen = new Map<string, Message>();
  for (const message of messages) {
    seen.set(message.id, message);
  }
  return sortMessages(Array.from(seen.values()));
}

function firstText(message: Message): string {
  const textPart = message.parts.find((part): part is TextPart => part.type === 'text');
  return textPart?.text.trim() ?? '';
}

function isRecentOptimistic(message: Message): boolean {
  if (!message.id.startsWith('optimistic-')) return false;
  return Date.now() - messageTimestamp(message) < 20_000;
}

function mergeMessage(prev: Message, incoming: Message): Message {
  return {
    ...prev,
    ...incoming,
    parts: incoming.parts.length > 0 ? incoming.parts : prev.parts,
    metadata: incoming.metadata ?? prev.metadata,
    createdAt: messageTimestamp(incoming) || messageTimestamp(prev),
  };
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
    parts?: unknown;
  };

  const source =
    typed.message ??
    (typed.info && Array.isArray(typed.parts)
      ? { info: typed.info, parts: typed.parts }
      : typed.info);

  const normalized = normalizeIncomingMessage(source);
  if (!normalized) return null;

  const sessionFromMessage =
    source && typeof source === 'object'
      ? (source as { sessionID?: unknown; sessionId?: unknown }).sessionID ??
        (source as { sessionID?: unknown; sessionId?: unknown }).sessionId
      : undefined;

  const sessionId = typed.sessionId ?? typed.sessionID ?? sessionFromMessage;
  if (typeof sessionId !== 'string') return null;

  return { sessionId, message: normalized };
}

function readMessageRemovedPayload(event: OpenCodeEvent): { sessionId: string; messageId: string } | null {
  if (event.type !== 'message.deleted' && event.type !== 'message.removed') return null;
  const props = (event as { properties?: unknown }).properties;
  if (!props || typeof props !== 'object') return null;
  const typed = props as {
    sessionId?: unknown;
    sessionID?: unknown;
    messageId?: unknown;
    messageID?: unknown;
  };
  const sessionId = typed.sessionId ?? typed.sessionID;
  const messageId = typed.messageId ?? typed.messageID;
  if (typeof sessionId !== 'string' || typeof messageId !== 'string') return null;
  return { sessionId, messageId };
}

function readPartUpdatedPayload(
  event: OpenCodeEvent,
): { sessionId: string; messageId: string; part: MessagePart | null; delta: string | null } | null {
  if (event.type !== 'message.part.updated') return null;
  const props = (event as { properties?: unknown }).properties;
  if (!props || typeof props !== 'object') return null;
  const typed = props as { part?: unknown; delta?: unknown };
  if (!typed.part || typeof typed.part !== 'object') return null;
  const rawPart = typed.part as {
    sessionID?: unknown;
    sessionId?: unknown;
    messageID?: unknown;
    messageId?: unknown;
  };
  const sessionId = rawPart.sessionID ?? rawPart.sessionId;
  const messageId = rawPart.messageID ?? rawPart.messageId;
  if (typeof sessionId !== 'string' || typeof messageId !== 'string') return null;

  return {
    sessionId,
    messageId,
    part: normalizeIncomingPart(typed.part),
    delta: typeof typed.delta === 'string' ? typed.delta : null,
  };
}

function readPartRemovedPayload(event: OpenCodeEvent): { sessionId: string; messageId: string } | null {
  if (event.type !== 'message.part.removed') return null;
  const props = (event as { properties?: unknown }).properties;
  if (!props || typeof props !== 'object') return null;
  const typed = props as { sessionID?: unknown; messageID?: unknown };
  if (typeof typed.sessionID !== 'string' || typeof typed.messageID !== 'string') return null;
  return { sessionId: typed.sessionID, messageId: typed.messageID };
}

function applyPartDelta(message: Message, part: MessagePart | null, delta: string | null): Message {
  if (!part && !delta) return message;

  const nextParts = [...message.parts];

  if (delta) {
    const targetType = part?.type === 'reasoning' ? 'reasoning' : 'text';
    const lastMatchIndex = [...nextParts]
      .reverse()
      .findIndex((item) => item.type === targetType);

    if (lastMatchIndex >= 0) {
      const index = nextParts.length - 1 - lastMatchIndex;
      const current = nextParts[index];
      if (current.type === 'text') {
        nextParts[index] = {
          ...current,
          text: (current as TextPart).text + delta,
        };
      } else if (current.type === 'reasoning') {
        nextParts[index] = {
          ...current,
          reasoning: current.reasoning + delta,
        };
      }
    } else if (targetType === 'reasoning') {
      nextParts.push({ type: 'reasoning', reasoning: delta });
    } else {
      nextParts.push({ type: 'text', text: delta });
    }
  }

  if (part) {
    if (part.type === 'tool-invocation') {
      const idx = nextParts.findIndex(
        (item) =>
          item.type === 'tool-invocation' &&
          (item as ToolInvocationPart).toolInvocation.toolCallId ===
            (part as ToolInvocationPart).toolInvocation.toolCallId,
      );
      if (idx >= 0) {
        nextParts[idx] = part;
      } else {
        nextParts.push(part);
      }
    } else if (!delta) {
      nextParts.push(part);
    }
  }

  return {
    ...message,
    parts: nextParts,
  };
}

export const messageKeys = {
  all: ['messages'] as const,
  session: (sessionId: string) => ['messages', sessionId] as const,
};

export interface UseMessagesResult {
  messages: Message[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isStreaming: boolean;
}

export function useMessages(sessionId: string | null): UseMessagesResult {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const queryClient = useQueryClient();
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReconcileAtRef = useRef(0);
  const lastPartEventAtRef = useRef(0);

  const triggerReconcile = useCallback(
    (delayMs = 0) => {
      const run = () => {
        if (!sessionIdRef.current) return;
        const now = Date.now();
        if (now - lastReconcileAtRef.current < 5_000) return;
        lastReconcileAtRef.current = now;
        void queryClient.invalidateQueries({
          queryKey: messageKeys.session(sessionIdRef.current),
        });
      };

      if (delayMs <= 0) {
        run();
        return;
      }

      if (reconcileTimerRef.current) {
        clearTimeout(reconcileTimerRef.current);
      }
      reconcileTimerRef.current = setTimeout(() => {
        reconcileTimerRef.current = null;
        run();
      }, delayMs);
    },
    [queryClient],
  );

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
      const serverMessages = await getMessages(client, sessionId);

      const cached = queryClient.getQueryData<Message[]>(messageKeys.session(sessionId)) ?? [];
      const serverUserMessages = serverMessages.filter((message) => message.role === 'user');
      const optimistic = cached
        .filter((message) => isRecentOptimistic(message))
        .filter((optimisticMessage) => {
          const optimisticText = firstText(optimisticMessage);
          if (!optimisticText) return true;
          const optimisticTs = messageTimestamp(optimisticMessage);
          return !serverUserMessages.some((serverMessage) => {
            const serverText = firstText(serverMessage);
            if (!serverText || serverText !== optimisticText) return false;
            const serverTs = messageTimestamp(serverMessage);
            return Math.abs(serverTs - optimisticTs) < 120_000;
          });
        });

      return dedupeAndSort([...serverMessages, ...optimistic]);
    },
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const handleEvent = useCallback(
    (event: OpenCodeEvent) => {
      const updated = readMessageUpdatedPayload(event);
      if (updated) {
        const { sessionId: evtSession, message } = updated;
        if (evtSession !== sessionIdRef.current) return;

        queryClient.setQueryData<Message[]>(messageKeys.session(evtSession), (prev) => {
          const list = prev ?? [];
          const base =
            message.role === 'user'
              ? list.filter((item) => !item.id.startsWith('optimistic-'))
              : list;
          const idx = base.findIndex((item) => item.id === message.id);
          if (idx < 0) {
            if (message.role === 'assistant' && message.parts.length === 0) {
              triggerReconcile(900);
              return base;
            }
            return dedupeAndSort([...base, message]);
          }

          const next = [...base];
          next[idx] = mergeMessage(base[idx], message);
          if (message.role === 'assistant' && message.parts.length === 0) {
            triggerReconcile(900);
          }
          return dedupeAndSort(next);
        });
        return;
      }

      const removed = readMessageRemovedPayload(event);
      if (removed) {
        if (removed.sessionId !== sessionIdRef.current) return;
        queryClient.setQueryData<Message[]>(messageKeys.session(removed.sessionId), (prev) =>
          dedupeAndSort((prev ?? []).filter((message) => message.id !== removed.messageId)),
        );
        return;
      }

      const partUpdated = readPartUpdatedPayload(event);
      if (partUpdated) {
        if (partUpdated.sessionId !== sessionIdRef.current) return;
        lastPartEventAtRef.current = Date.now();
        queryClient.setQueryData<Message[]>(messageKeys.session(partUpdated.sessionId), (prev) => {
          const list = prev ?? [];
          const idx = list.findIndex((message) => message.id === partUpdated.messageId);
          if (idx < 0) {
            const created = applyPartDelta(
              {
                id: partUpdated.messageId,
                role: 'assistant',
                parts: [],
                createdAt: Date.now(),
              },
              partUpdated.part,
              partUpdated.delta,
            );
            return dedupeAndSort([...list, created]);
          }
          const next = [...list];
          next[idx] = applyPartDelta(next[idx], partUpdated.part, partUpdated.delta);
          return dedupeAndSort(next);
        });
        return;
      }

      const partRemoved = readPartRemovedPayload(event);
      if (partRemoved) {
        if (partRemoved.sessionId !== sessionIdRef.current) return;
        lastPartEventAtRef.current = Date.now();
        queryClient.setQueryData<Message[]>(messageKeys.session(partRemoved.sessionId), (prev) => {
          const list = prev ?? [];
          const idx = list.findIndex((message) => message.id === partRemoved.messageId);
          if (idx < 0) return list;
          const next = [...list];
          const target = next[idx];
          next[idx] = {
            ...target,
            parts: target.parts.slice(0, Math.max(0, target.parts.length - 1)),
          };
          return dedupeAndSort(next);
        });
      }
    },
    [queryClient],
  );

  useSSEStream({
    enabled: sessionId !== null,
    onEvent: handleEvent,
    onReconnect: () => {
      if (!sessionIdRef.current) return;
      triggerReconcile(200);
    },
  });

  useEffect(() => {
    return () => {
      if (reconcileTimerRef.current) {
        clearTimeout(reconcileTimerRef.current);
      }
    };
  }, []);

  const messages = data ?? [];
  const lastMessage = messages.at(-1);
  const hasOptimisticUser = messages.some((message) => isRecentOptimistic(message));

  const hasPartialToolCall =
    lastMessage?.parts.some(
      (part) =>
        part.type === 'tool-invocation' &&
        (part as ToolInvocationPart).toolInvocation.state !== 'result',
    ) ?? false;

  const hasNoText =
    (lastMessage?.parts.every(
      (part) =>
        part.type !== 'text' ||
        (part.type === 'text' && (part as TextPart).text.trim().length === 0),
    ) ??
      false) && (lastMessage?.parts.length ?? 0) > 0;

  const assistantStreaming =
    lastMessage?.role === 'assistant' &&
    (hasPartialToolCall ||
      (hasNoText && Date.now() - messageTimestamp(lastMessage) < 30_000));

  const lastUserIdx = [...messages].reverse().findIndex((message) => message.role === 'user');
  const lastAssistantIdx = [...messages].reverse().findIndex((message) => message.role === 'assistant');
  const newestUser = lastUserIdx >= 0 ? messages[messages.length - 1 - lastUserIdx] : null;
  const awaitingAssistant =
    newestUser !== null &&
    (lastAssistantIdx === -1 || lastUserIdx < lastAssistantIdx) &&
    Date.now() - messageTimestamp(newestUser) < 30_000;

  const isStreaming = hasOptimisticUser || assistantStreaming || awaitingAssistant;

  useEffect(() => {
    if (!isStreaming) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      const lastPartAge =
        lastPartEventAtRef.current > 0 ? now - lastPartEventAtRef.current : Number.POSITIVE_INFINITY;
      const newestAge = lastMessage ? now - messageTimestamp(lastMessage) : Number.POSITIVE_INFINITY;

      if (lastPartAge > 12_000 && newestAge > 12_000) {
        triggerReconcile(0);
      }
    }, 12_000);

    return () => clearTimeout(timer);
  }, [isStreaming, lastMessage?.id, triggerReconcile]);

  return {
    messages,
    isLoading,
    isError,
    error: error ?? null,
    isStreaming,
  };
}
