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

function normalizeRawEntry(entry: unknown): FileEntry | null {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    const isDir = trimmed.endsWith('/');
    const path = isDir ? trimmed.replace(/\/+$/, '') : trimmed;
    return {
      path,
      type: isDir ? 'directory' : 'file',
      name: path.split('/').filter(Boolean).pop() ?? path,
    };
  }

  if (typeof entry !== 'object' || entry === null) return null;

  const candidate = entry as {
    name?: unknown;
    path?: unknown;
    absolute?: unknown;
    type?: unknown;
    kind?: unknown;
    ignored?: unknown;
  };

  const typeRaw =
    candidate.type === 'file' || candidate.type === 'directory'
      ? candidate.type
      : candidate.kind === 'file' || candidate.kind === 'directory'
        ? candidate.kind
        : null;

  const pathRaw =
    typeof candidate.path === 'string'
      ? candidate.path
      : typeof candidate.absolute === 'string'
        ? candidate.absolute
        : typeof candidate.name === 'string'
          ? candidate.name
          : null;

  if (!pathRaw || !typeRaw) return null;

  const normalizedPath = pathRaw.replace(/\/+$/, '') || pathRaw;
  return {
    path: normalizedPath,
    type: typeRaw,
    name:
      typeof candidate.name === 'string'
        ? candidate.name
        : normalizedPath.split('/').filter(Boolean).pop() ?? normalizedPath,
    absolute: typeof candidate.absolute === 'string' ? candidate.absolute : undefined,
    ignored: typeof candidate.ignored === 'boolean' ? candidate.ignored : undefined,
  };
}

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
      const raw = await listFiles(client, dirPath);
      const entries: FileEntry[] = Array.isArray(raw)
        ? raw
            .map((entry) => normalizeRawEntry(entry))
            .filter((entry): entry is FileEntry => entry !== null)
        : [];
      // Sort: directories first, then files, both alphabetically.
      return [...entries].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        const aName = a.name ?? a.path;
        const bName = b.name ?? b.path;
        return aName.localeCompare(bName);
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
