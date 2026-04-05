import { useQuery } from '@tanstack/react-query';
import { createOpenCodeClient, getSessionDiff } from '@driftcode/opencode-client';
import type { FileDiff } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';

export const sessionDiffKeys = {
  message: (sessionId: string, messageId: string) => ['sessionDiff', sessionId, messageId] as const,
};

export function useSessionDiff(sessionId: string | null, messageId: string | null) {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const query = useQuery<FileDiff[], Error>({
    queryKey: sessionDiffKeys.message(sessionId ?? '', messageId ?? ''),
    enabled:
      serverUrl !== null &&
      serverPassword !== null &&
      sessionId !== null &&
      messageId !== null,
    queryFn: async () => {
      if (!serverUrl || !serverPassword || !sessionId || !messageId) return [];
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      const raw = await getSessionDiff(client, sessionId, messageId);
      return Array.isArray(raw) ? raw : [];
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  return {
    diffs: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
