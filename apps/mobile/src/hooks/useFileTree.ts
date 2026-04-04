/**
 * useFileTree
 *
 * Lazily fetches the children of a single directory path.
 * Call once per directory; the query is keyed by path so repeated
 * expansions reuse the cache.
 */
import { useQuery } from '@tanstack/react-query';
import { listFiles, createOpenCodeClient } from '@driftcode/opencode-client';
import type { FileEntry } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------
export const fileTreeKeys = {
  dir: (path: string) => ['fileTree', path] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export interface UseFileTreeResult {
  entries: FileEntry[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useFileTree(dirPath: string, enabled = true): UseFileTreeResult {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const { data, isLoading, isError, error, refetch } = useQuery<FileEntry[], Error>({
    queryKey: fileTreeKeys.dir(dirPath),
    enabled: enabled && serverUrl !== null && serverPassword !== null,
    queryFn: async () => {
      if (!serverUrl || !serverPassword) return [];
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      const entries = await listFiles(client, dirPath);
      // Sort: directories first, then files, both alphabetically.
      return [...entries].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.path.localeCompare(b.path);
      });
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    entries: data ?? [],
    isLoading,
    isError,
    error: error ?? null,
    refresh: async () => { await refetch(); },
  };
}
