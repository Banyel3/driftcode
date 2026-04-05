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
  server: (serverUrl: string) => ['commands', serverUrl] as const,
};

export function useCommands(): Command[] {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const { data } = useQuery<Command[], Error>({
    queryKey: commandKeys.server(serverUrl ?? ''),
    enabled: serverUrl !== null && serverPassword !== null,
    queryFn: async () => {
      if (!serverUrl || !serverPassword) return [];
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      return listCommands(client);
    },
    // Commands only change when the user edits their opencode config.
    staleTime: 5 * 60 * 1_000,
    gcTime: 10 * 60 * 1_000,
  });

  return data ?? [];
}
