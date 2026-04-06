import { useQuery } from '@tanstack/react-query';
import { createOpenCodeClient, listAgents } from '@driftcode/opencode-client';
import type { AgentInfo } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';

export const agentKeys = {
  all: ['agents'] as const,
  server: (serverUrl: string, username: string) =>
    ['agents', serverUrl, username] as const,
};

export interface UseAgentsResult {
  agents: AgentInfo[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function normalizeAgents(raw: unknown): AgentInfo[] {
  if (!Array.isArray(raw)) return [];

  const deduped = new Map<string, AgentInfo>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Record<string, unknown>;
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    if (!name) continue;

    const description =
      typeof value.description === 'string' ? value.description : undefined;
    const mode =
      value.mode === 'subagent' || value.mode === 'primary' || value.mode === 'all'
        ? value.mode
        : undefined;
    const variant = typeof value.variant === 'string' ? value.variant : undefined;

    deduped.set(name.toLowerCase(), {
      name,
      ...(description ? { description } : {}),
      ...(mode ? { mode } : {}),
      ...(variant ? { variant } : {}),
    });
  }

  return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function useAgents(): UseAgentsResult {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const { data, isLoading, error, refetch } = useQuery<AgentInfo[], Error>({
    queryKey: agentKeys.server(serverUrl ?? '', serverUsername ?? ''),
    enabled: serverUrl !== null && serverPassword !== null,
    queryFn: async () => {
      if (!serverUrl || !serverPassword) return [];
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      const raw = await listAgents(client);
      return normalizeAgents(raw);
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1_000,
    refetchOnMount: 'always',
  });

  return {
    agents: data ?? [],
    isLoading,
    error: error ?? null,
    refetch: async () => {
      await refetch();
    },
  };
}
