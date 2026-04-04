import type { OpenCodeClient } from './client';
import type { HealthResponse } from './types';

/**
 * GET /global/health
 * Used for connection testing and to read the server version.
 */
export async function getHealth(
  client: OpenCodeClient,
): Promise<HealthResponse> {
  return client.get<HealthResponse>('/global/health');
}
