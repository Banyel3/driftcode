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

const FALLBACK_BUILTIN_COMMANDS: Command[] = [
  { name: 'init', description: 'guided AGENTS.md setup', type: 'builtin' },
  { name: 'review', description: 'review current changes', type: 'builtin' },
  { name: 'share', description: 'create a share link for this session', type: 'builtin' },
  { name: 'unshare', description: 'remove the session share link', type: 'builtin' },
  { name: 'fork', description: 'create a fork of this session', type: 'builtin' },
  { name: 'undo', description: 'revert to previous user message', type: 'builtin' },
  { name: 'redo', description: 'restore reverted messages', type: 'builtin' },
  { name: 'help', description: 'show help for commands', type: 'builtin' },
];

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

  for (const fallback of FALLBACK_BUILTIN_COMMANDS) {
    if (!deduped.has(fallback.name.toLowerCase())) {
      deduped.set(fallback.name.toLowerCase(), fallback);
    }
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
