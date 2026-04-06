/**
 * useFileContent
 *
 * Fetches the raw string content of a single file.
 * Keyed by file path; cached indefinitely within the session
 * (staleTime: Infinity) since file content rarely changes while the user
 * is viewing it.
 */
import { useQuery } from '@tanstack/react-query';
import { getFileContent, createOpenCodeClient } from '@driftcode/opencode-client';
import type { FileContentResponse } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------
export const fileContentKeys = {
  file: (path: string) => ['fileContent', path] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export interface UseFileContentResult {
  contentText: string | null;
  contentType: 'text' | 'binary' | null;
  contentEncoding: string | null;
  mimeType: string | null;
  diff: string | null;
  patch: unknown;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useFileContent(
  filePath: string | null,
): UseFileContentResult {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const { data, isLoading, isError, error, refetch } = useQuery<FileContentResponse, Error>({
    queryKey: fileContentKeys.file(filePath ?? ''),
    enabled: filePath !== null && serverUrl !== null && serverPassword !== null,
    queryFn: async () => {
      if (!filePath || !serverUrl || !serverPassword) {
        return { type: 'text', content: '' } as FileContentResponse;
      }
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      return getFileContent(client, filePath);
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  return {
    contentText: data?.content ?? null,
    contentType: data?.type ?? null,
    contentEncoding: data?.encoding ?? null,
    mimeType: data?.mimeType ?? null,
    diff: data?.diff ?? null,
    patch: data?.patch,
    isLoading,
    isError,
    error: error ?? null,
    refresh: async () => { await refetch(); },
  };
}
