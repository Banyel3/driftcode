/**
 * useCommands
 *
 * Fetches the list of slash commands available on the connected opencode
 * server: built-in commands (init, undo, redo, share, help, …) plus any
 * custom commands defined in the project's .opencode/commands/ directory.
 *
 * Results are cached for 5 minutes — the list rarely changes during a session.
 *
 * Architecture rule: all API calls go through @driftcode/opencode-client.
 */
import { useQuery } from '@tanstack/react-query';
import { listCommands, createOpenCodeClient } from '@driftcode/opencode-client';
import type { Command } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';

export const commandKeys = {
  all: ['commands'] as const,
  server: (serverUrl: string, username: string, sessionId: string) =>
    ['commands', serverUrl, username, sessionId] as const,
};

export interface UseCommandsResult {
  commands: Command[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function normalizeCommandName(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
}

function normalizeCommands(raw: unknown): Command[] {
  if (!Array.isArray(raw)) return [];

  const deduped = new Map<string, Command>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;

    const maybeName = (item as { name?: unknown }).name;
    if (typeof maybeName !== 'string') continue;

    const name = normalizeCommandName(maybeName);
    if (!name) continue;

    const maybeDescription = (item as { description?: unknown }).description;
    const maybeType = (item as { type?: unknown }).type;

    const normalized: Command = {
      name,
      description: typeof maybeDescription === 'string' ? maybeDescription : undefined,
      type: maybeType === 'builtin' || maybeType === 'user' ? maybeType : undefined,
    };

    deduped.set(name.toLowerCase(), normalized);
  }

  return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function useCommands(sessionId: string | null): UseCommandsResult {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<Command[], Error>({
    queryKey: commandKeys.server(
      serverUrl ?? '',
      serverUsername ?? '',
      sessionId ?? '',
    ),
    enabled: serverUrl !== null && serverPassword !== null && sessionId !== null,
    queryFn: async () => {
      if (!serverUrl || !serverPassword || !sessionId) return [];
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      const raw = await listCommands(client);
      return normalizeCommands(raw);
    },
    // Commands only change when the user edits their opencode config.
    staleTime: 30_000,
    gcTime: 5 * 60 * 1_000,
    refetchOnMount: 'always',
  });

  return {
    commands: data ?? [],
    isLoading,
    error: error ?? null,
    refetch: async () => { await refetch(); },
  };
}
