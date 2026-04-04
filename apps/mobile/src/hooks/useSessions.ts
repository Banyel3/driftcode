/**
 * useSessions
 *
 * Fetches all sessions (GET /session) and keeps the list live via the global
 * SSE event stream.
 *
 * The SSE stream delivers `session.updated` / `session.deleted` events that
 * are patched directly into the TanStack Query cache, so the UI updates
 * without a full refetch.
 *
 * Also exposes a `remove` mutation (DELETE /session/:id).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  listSessions,
  deleteSession,
  createOpenCodeClient,
} from '@driftcode/opencode-client';
import type { Session, OpenCodeEvent } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';
import { useSSEStream } from './useSSEStream';

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------
export const sessionKeys = {
  all: ['sessions'] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export interface UseSessionsResult {
  sessions: Session[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Refetch the full list (e.g. on pull-to-refresh). */
  refresh: () => Promise<void>;
  isRefreshing: boolean;
  /** Delete a session by id. */
  remove: (sessionId: string) => void;
  isRemoving: boolean;
}

export function useSessions(): UseSessionsResult {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const queryClient = useQueryClient();

  // ── 1. Fetch list ─────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery<Session[], Error>({
    queryKey: sessionKeys.all,
    enabled: serverUrl !== null && serverPassword !== null,
    queryFn: async () => {
      if (!serverUrl || !serverPassword) return [];
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      const raw = await listSessions(client);
      return Array.isArray(raw) ? raw : [];
    },
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  // ── 2. SSE — patch session list in real time ───────────────────────────────
  const handleEvent = useCallback(
    (event: OpenCodeEvent) => {
      if (event.type === 'session.updated') {
        const updated = event.properties;
        queryClient.setQueryData<Session[]>(sessionKeys.all, (prev) => {
          if (!prev) return [updated];
          const idx = prev.findIndex((s) => s.id === updated.id);
          if (idx === -1) {
            // New session — prepend so newest is first.
            return [updated, ...prev];
          }
          const next = [...prev];
          next[idx] = updated;
          return next;
        });
      }

      if (event.type === 'session.deleted') {
        const { id } = event.properties;
        queryClient.setQueryData<Session[]>(sessionKeys.all, (prev) =>
          (prev ?? []).filter((s) => s.id !== id),
        );
      }
    },
    [queryClient],
  );

  useSSEStream({
    enabled: serverUrl !== null && serverPassword !== null,
    onEvent: handleEvent,
  });

  // ── 3. Delete mutation ────────────────────────────────────────────────────
  const { mutate: removeMutate, isPending: isRemoving } = useMutation<
    void,
    Error,
    string
  >({
    mutationFn: async (sessionId: string) => {
      if (!serverUrl || !serverPassword) return;
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      await deleteSession(client, sessionId);
    },
    onMutate: async (sessionId) => {
      // Optimistic removal.
      queryClient.setQueryData<Session[]>(sessionKeys.all, (prev) =>
        (prev ?? []).filter((s) => s.id !== sessionId),
      );
    },
    onError: () => {
      // Revert by re-fetching on error.
      void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });

  return {
    sessions: (data ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt),
    isLoading,
    isError,
    error: error ?? null,
    refresh: async () => {
      await refetch();
    },
    isRefreshing: isFetching && !isLoading,
    remove: (id) => removeMutate(id),
    isRemoving,
  };
}
