import type { OpenCodeClient } from './client';
import type { ProviderInfo, ConfigProvidersResponse, AgentInfo } from './types';

/**
 * GET /provider
 * Returns all available providers (installed on the server).
 */
export async function listProviders(
  client: OpenCodeClient,
): Promise<ProviderInfo[]> {
  return client.get<ProviderInfo[]>('/provider');
}

/**
 * GET /config/providers
 * Returns providers that are configured and ready to use (have credentials set).
 */
export async function getConfiguredProviders(
  client: OpenCodeClient,
): Promise<ProviderInfo[] | ConfigProvidersResponse> {
  return client.get<ProviderInfo[] | ConfigProvidersResponse>('/config/providers');
}

/**
 * GET /agent
 * Lists available agents for prompts.
 */
export async function listAgents(
  client: OpenCodeClient,
): Promise<AgentInfo[]> {
  return client.get<AgentInfo[]>('/agent');
}

/**
 * PUT /auth/:id
 * Sets credentials for a provider (API key etc.)
 */
export async function setProviderAuth(
  client: OpenCodeClient,
  providerId: string,
  credentials: Record<string, string>,
): Promise<void> {
  return client.put<void>(`/auth/${providerId}`, credentials);
}
