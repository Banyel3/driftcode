import type { OpenCodeClient } from './client';
import type { Message, SendMessageRequest } from './types';

/**
 * GET /session/:id/message
 * Returns the full message history for a session.
 */
export async function getMessages(
  client: OpenCodeClient,
  sessionId: string,
): Promise<Message[]> {
  return client.get<Message[]>(`/session/${sessionId}/message`);
}

/**
 * POST /session/:id/message
 * Sends a message and waits for the full response (non-streaming).
 * For streaming responses, subscribe to the SSE event stream instead.
 */
export async function sendMessage(
  client: OpenCodeClient,
  sessionId: string,
  request: SendMessageRequest,
): Promise<Message> {
  return client.post<Message>(`/session/${sessionId}/message`, request);
}

/**
 * POST /session/:id/prompt_async
 * Sends a message without waiting for the response. The AI reply streams
 * back via the global SSE event stream (GET /event).
 */
export async function sendMessageAsync(
  client: OpenCodeClient,
  sessionId: string,
  request: SendMessageRequest,
): Promise<void> {
  return client.post<void>(`/session/${sessionId}/prompt_async`, request);
}
