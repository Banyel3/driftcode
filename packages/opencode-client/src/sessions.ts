import type { OpenCodeClient } from './client';
import type { Session, CreateSessionRequest } from './types';

/**
 * GET /session
 * Returns all sessions sorted by most recently updated.
 */
export async function listSessions(client: OpenCodeClient): Promise<Session[]> {
  return client.get<Session[]>('/session');
}

/**
 * GET /session/:id
 */
export async function getSession(
  client: OpenCodeClient,
  sessionId: string,
): Promise<Session> {
  return client.get<Session>(`/session/${sessionId}`);
}

/**
 * POST /session
 * Creates a new session. Optionally accepts a model and working-directory path.
 * Session initialisation can take a while (model warm-up, workspace setup),
 * so we allow up to 60 seconds before timing out.
 */
export async function createSession(
  client: OpenCodeClient,
  request: CreateSessionRequest = {},
): Promise<Session> {
  return client.post<Session>('/session', request, 60_000);
}

/**
 * DELETE /session/:id
 */
export async function deleteSession(
  client: OpenCodeClient,
  sessionId: string,
): Promise<void> {
  return client.delete<void>(`/session/${sessionId}`);
}
