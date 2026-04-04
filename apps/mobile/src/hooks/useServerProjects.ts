/**
 * useServerProjects
 *
 * Fetches the list of projects known to the opencode server (GET /project).
 * These are directories on the server that have been opened at least once.
 */
import { useQuery } from '@tanstack/react-query';
import { listProjects, createOpenCodeClient } from '@driftcode/opencode-client';
import type { Project } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';

export const serverProjectKeys = {
  all: ['serverProjects'] as const,
};

export interface UseServerProjectsResult {
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

export function useServerProjects(): UseServerProjectsResult {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery<
    Project[],
    Error
  >({
    queryKey: serverProjectKeys.all,
    enabled: serverUrl !== null && serverPassword !== null,
    queryFn: async () => {
      if (!serverUrl || !serverPassword) return [];
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      return listProjects(client);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    projects: data ?? [],
    isLoading,
    isError,
    error: error ?? null,
    refresh: async () => { await refetch(); },
    isRefreshing: isFetching && !isLoading,
  };
}
