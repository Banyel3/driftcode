/**
 * useProviders
 *
 * Fetches the list of configured AI providers from the opencode server
 * (GET /config/providers). Returns a flat list of { providerId, providerName,
 * modelId, modelName } options suitable for a picker.
 *
 * Architecture rule: all API calls go through @driftcode/opencode-client.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getConfiguredProviders,
  createOpenCodeClient,
} from '@driftcode/opencode-client';
import type { ProviderInfo, ModelInfo } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ProviderModelOption {
  /** e.g. "anthropic" */
  providerId: string;
  /** e.g. "Anthropic" */
  providerName: string;
  /** e.g. "claude-3-7-sonnet-20250219" */
  modelId: string;
  /** e.g. "Claude 3.7 Sonnet" */
  modelName: string;
  /** Optional context window size in tokens */
  contextLength?: number;
}

export interface UseProvidersResult {
  /** All available provider+model combinations */
  options: ProviderModelOption[];
  /** Raw provider list (if needed) */
  providers: ProviderInfo[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

export const providerKeys = {
  configured: ['providers', 'configured'] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProviders(): UseProvidersResult {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  const { data, isLoading, isError, error, refetch } = useQuery<
    ProviderInfo[],
    Error
  >({
    queryKey: providerKeys.configured,
    enabled: serverUrl !== null && serverPassword !== null,
    queryFn: async (): Promise<ProviderInfo[]> => {
      if (!serverUrl || !serverPassword) return [];
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      const raw = await getConfiguredProviders(client);
      // The server may return an object map instead of an array depending on
      // the opencode version — normalise to array defensively.
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object') return Object.values(raw) as ProviderInfo[];
      return [];
    },
    staleTime: 5 * 60_000, // 5 minutes — providers rarely change
    refetchOnWindowFocus: false,
  });

  const providers = Array.isArray(data) ? data : [];

  // Flatten providers → models into a single list for use in pickers.
  // Defensively validate every field — the server shape varies by version.
  const options: ProviderModelOption[] = providers.flatMap(
    (provider: ProviderInfo) => {
      if (
        !provider ||
        typeof provider.id !== 'string' ||
        typeof provider.name !== 'string'
      ) {
        return [];
      }
      const models = Array.isArray(provider.models) ? provider.models : [];
      return models
        .filter(
          (model: ModelInfo) =>
            model != null &&
            typeof model.id === 'string' &&
            typeof model.name === 'string',
        )
        .map((model: ModelInfo) => ({
          providerId: provider.id,
          providerName: provider.name,
          modelId: model.id,
          modelName: model.name,
          contextLength: model.contextLength,
        }));
    },
  );

  return {
    options,
    providers,
    isLoading,
    isError,
    error: error ?? null,
    refresh: async () => {
      await refetch();
    },
  };
}
