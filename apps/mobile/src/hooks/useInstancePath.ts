import { useQuery } from '@tanstack/react-query';
import {
  createOpenCodeClient,
  getInstancePathInfo,
} from '@driftcode/opencode-client';
import type { InstancePathInfo } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';

export const instancePathKeys = {
  current: ['instancePath'] as const,
};

export function useInstancePath() {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const query = useQuery<InstancePathInfo | null, Error>({
    queryKey: instancePathKeys.current,
    enabled: serverUrl !== null && serverPassword !== null,
    queryFn: async () => {
      if (!serverUrl || !serverPassword) return null;
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      return getInstancePathInfo(client);
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  return {
    pathInfo: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
