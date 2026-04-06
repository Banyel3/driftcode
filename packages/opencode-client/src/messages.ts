import type { OpenCodeClient } from './client';
import type {
  Message,
  MessagePart,
  SendMessageRequest,
  MessageRole,
  ToolInvocation,
} from './types';

const PROMPT_ASYNC_TIMEOUT_MS = 30_000;

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeRole(value: unknown): MessageRole {
  if (value === 'user' || value === 'assistant' || value === 'tool') return value;
  if (value === 'human') return 'user';
  return 'assistant';
}

function normalizeToolState(state: unknown): ToolInvocation['state'] {
  if (state === 'result' || state === 'completed' || state === 'done' || state === 'success') {
    return 'result';
  }
  if (state === 'partial-call' || state === 'streaming' || state === 'running') {
    return 'partial-call';
  }
  return 'call';
}

export function normalizeIncomingPart(part: unknown): MessagePart | null {
  if (!part || typeof part !== 'object') return null;
  const p = part as Record<string, unknown>;
  const type = p.type;

  if (type === 'text') {
    const text = typeof p.text === 'string' ? p.text : '';
    return { type: 'text', text };
  }

  if (type === 'reasoning') {
    const reasoning =
      typeof p.reasoning === 'string'
        ? p.reasoning
        : typeof p.text === 'string'
          ? p.text
          : '';
    return { type: 'reasoning', reasoning };
  }

  if (type === 'tool-invocation') {
    const toolInvocation = p.toolInvocation;
    if (!toolInvocation || typeof toolInvocation !== 'object') return null;
    return {
      type: 'tool-invocation',
      toolInvocation: toolInvocation as ToolInvocation,
    };
  }

  if (type === 'tool') {
    const toolName = typeof p.tool === 'string' ? p.tool : 'tool';
    const toolCallId =
      typeof p.callID === 'string'
        ? p.callID
        : typeof p.id === 'string'
          ? p.id
          : `${toolName}-${Date.now()}`;
    const args =
      p.input && typeof p.input === 'object'
        ? (p.input as Record<string, unknown>)
        : p.args && typeof p.args === 'object'
          ? (p.args as Record<string, unknown>)
          : {};
    const result = p.output ?? p.result;
    return {
      type: 'tool-invocation',
      toolInvocation: {
        state: normalizeToolState(p.state),
        toolCallId,
        toolName,
        args,
        ...(result !== undefined ? { result } : {}),
      },
    };
  }

  if (type === 'file') {
    const mimeType =
      typeof p.mimeType === 'string'
        ? p.mimeType
        : typeof p.mime === 'string'
          ? p.mime
          : 'application/octet-stream';
    const data =
      typeof p.data === 'string'
        ? p.data
        : typeof p.url === 'string'
          ? p.url
          : '';
    return { type: 'file', mimeType, data };
  }

  if (type === 'step-start') {
    return { type: 'step-start' };
  }

  return null;
}

export function normalizeIncomingMessage(raw: unknown, fallbackIndex = 0): Message | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const info =
    value.info && typeof value.info === 'object'
      ? (value.info as Record<string, unknown>)
      : value;

  const id =
    typeof info.id === 'string'
      ? info.id
      : typeof value.id === 'string'
        ? value.id
        : `synthetic-${fallbackIndex}`;

  const role = normalizeRole(info.role ?? value.role);

  const createdAt =
    num(value.createdAt) ??
    num((value.time as { created?: unknown } | undefined)?.created) ??
    num((info.time as { created?: unknown } | undefined)?.created) ??
    0;

  const rawParts = Array.isArray(value.parts)
    ? value.parts
    : Array.isArray(info.parts)
      ? info.parts
      : [];

  const parts = rawParts
    .map((part) => normalizeIncomingPart(part))
    .filter((part): part is MessagePart => part !== null);

  return {
    id,
    role,
    parts,
    createdAt,
    metadata:
      (info.metadata && typeof info.metadata === 'object'
        ? (info.metadata as Record<string, unknown>)
        : undefined) ??
      (value.metadata && typeof value.metadata === 'object'
        ? (value.metadata as Record<string, unknown>)
        : undefined),
  };
}

export function normalizeIncomingMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .map((msg, index) => normalizeIncomingMessage(msg, index))
    .filter((msg): msg is Message => msg !== null);

  return normalized
    .map((msg, index) => ({ msg, index }))
    .sort((a, b) => {
      const ts = a.msg.createdAt - b.msg.createdAt;
      if (ts !== 0) return ts;
      return a.index - b.index;
    })
    .map(({ msg }) => msg);
}

/**
 * GET /session/:id/message
 * Returns the full message history for a session.
 */
export async function getMessages(
  client: OpenCodeClient,
  sessionId: string,
): Promise<Message[]> {
  const raw = await client.get<unknown>(`/session/${sessionId}/message`);
  return normalizeIncomingMessages(raw);
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
  const raw = await client.post<unknown>(`/session/${sessionId}/message`, request);
  return normalizeIncomingMessage(raw) ?? {
    id: `fallback-${Date.now()}`,
    role: 'assistant',
    parts: [],
    createdAt: Date.now(),
  };
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
  return client.post<void>(
    `/session/${sessionId}/prompt_async`,
    request,
    PROMPT_ASYNC_TIMEOUT_MS,
  );
}
