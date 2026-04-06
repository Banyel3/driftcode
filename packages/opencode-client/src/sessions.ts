import type { OpenCodeClient } from './client';
import type { Session, CreateSessionRequest, FileDiff } from './types';

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

/**
 * GET /session/:id/diff?messageID=<messageID>
 * Returns changed files for a specific message in a session.
 */
export async function getSessionDiff(
  client: OpenCodeClient,
  sessionId: string,
  messageId: string,
): Promise<FileDiff[]> {
  const encodedMessageId = encodeURIComponent(messageId);
  return client.get<FileDiff[]>(`/session/${sessionId}/diff?messageID=${encodedMessageId}`);
}

/** POST /session/:id/share */
export async function shareSession(
  client: OpenCodeClient,
  sessionId: string,
): Promise<Session> {
  return client.post<Session>(`/session/${sessionId}/share`, {});
}

/** DELETE /session/:id/share */
export async function unshareSession(
  client: OpenCodeClient,
  sessionId: string,
): Promise<Session> {
  return client.delete<Session>(`/session/${sessionId}/share`);
}

/** POST /session/:id/fork */
export async function forkSession(
  client: OpenCodeClient,
  sessionId: string,
  messageId?: string,
): Promise<Session> {
  return client.post<Session>(`/session/${sessionId}/fork`, messageId ? { messageID: messageId } : {});
}

/** POST /session/:id/revert */
export async function revertSession(
  client: OpenCodeClient,
  sessionId: string,
  messageId: string,
): Promise<Session> {
  return client.post<Session>(`/session/${sessionId}/revert`, { messageID: messageId });
}

/** POST /session/:id/unrevert */
export async function unrevertSession(
  client: OpenCodeClient,
  sessionId: string,
): Promise<Session> {
  return client.post<Session>(`/session/${sessionId}/unrevert`, {});
}
