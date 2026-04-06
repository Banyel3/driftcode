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
import type {
  ProviderInfo,
  ModelInfo,
  ConfigProvidersResponse,
} from '@driftcode/opencode-client';
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
  isDefault?: boolean;
}

export interface UseProvidersResult {
  /** All available provider+model combinations */
  options: ProviderModelOption[];
  /** Raw provider list (if needed) */
  providers: ProviderInfo[];
  defaults: Record<string, string>;
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
    { providers: ProviderInfo[]; defaults: Record<string, string> },
    Error
  >({
    queryKey: providerKeys.configured,
    enabled: serverUrl !== null && serverPassword !== null,
    queryFn: async (): Promise<{ providers: ProviderInfo[]; defaults: Record<string, string> }> => {
      if (!serverUrl || !serverPassword) return { providers: [], defaults: {} };
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      const raw = await getConfiguredProviders(client);
      if (Array.isArray(raw)) {
        return { providers: raw, defaults: {} };
      }
      if (raw && typeof raw === 'object') {
        const typed = raw as ConfigProvidersResponse;
        if (Array.isArray(typed.providers)) {
          return {
            providers: typed.providers,
            defaults:
              typed.default && typeof typed.default === 'object'
                ? typed.default
                : {},
          };
        }
      }
      return { providers: [], defaults: {} };
    },
    staleTime: 5 * 60_000, // 5 minutes — providers rarely change
    refetchOnWindowFocus: false,
  });

  const providers = data?.providers ?? [];
  const defaults = data?.defaults ?? {};

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
          isDefault: defaults[provider.id] === model.id,
        }));
    },
  );

  options.sort((a, b) => {
    if (a.providerId !== b.providerId) return a.providerName.localeCompare(b.providerName);
    if (!!a.isDefault !== !!b.isDefault) return a.isDefault ? -1 : 1;
    return a.modelName.localeCompare(b.modelName);
  });

  return {
    options,
    providers,
    defaults,
    isLoading,
    isError,
    error: error ?? null,
    refresh: async () => {
      await refetch();
    },
  };
}
