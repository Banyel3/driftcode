// ─── opencode REST API Types ─────────────────────────────────────────────────
// Modelled after the opencode OpenAPI spec (available at <server>/doc).
// All API calls flow through the OpenCodeClient — never use fetch directly
// from app components.

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
export interface HealthResponse {
  version: string;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
export interface Session {
  id: string;
  title?: string | null;
  parentId?: string | null;
  model?: string | null;
  /** Absolute path to the project directory on the server */
  path?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSessionRequest {
  model?: string;
  path?: string;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export type MessageRole = 'user' | 'assistant' | 'tool';

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ToolInvocation {
  state: 'call' | 'result' | 'partial-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocation: ToolInvocation;
}

export interface StepStartPart {
  type: 'step-start';
}

export interface FilePart {
  type: 'file';
  mimeType: string;
  data: string;
}

export interface ReasoningPart {
  type: 'reasoning';
  reasoning: string;
}

export type MessagePart =
  | TextPart
  | ToolInvocationPart
  | StepStartPart
  | FilePart
  | ReasoningPart;

export interface Message {
  id: string;
  role: MessageRole;
  parts: MessagePart[];
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface SendMessageRequest {
  parts: TextPart[];
  model?: string;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------
export interface FileEntry {
  path: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
}

// ---------------------------------------------------------------------------
// Providers / Models
// ---------------------------------------------------------------------------
export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export interface Project {
  id: string;
  path: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// VCS
// ---------------------------------------------------------------------------
export interface VCSInfo {
  branch?: string;
  repoUrl?: string;
  isDirty?: boolean;
  ahead?: number;
  behind?: number;
}

// ---------------------------------------------------------------------------
// SSE Events
// ---------------------------------------------------------------------------
export type EventType =
  | 'session.updated'
  | 'session.deleted'
  | 'message.updated'
  | 'message.deleted'
  | 'reload';

export interface SessionUpdatedEvent {
  type: 'session.updated';
  properties: Session;
}

export interface SessionDeletedEvent {
  type: 'session.deleted';
  properties: { id: string };
}

export interface MessageUpdatedEvent {
  type: 'message.updated';
  properties: {
    sessionId: string;
    message: Message;
  };
}

export interface MessageDeletedEvent {
  type: 'message.deleted';
  properties: {
    sessionId: string;
    messageId: string;
  };
}

export interface ReloadEvent {
  type: 'reload';
}

export type OpenCodeEvent =
  | SessionUpdatedEvent
  | SessionDeletedEvent
  | MessageUpdatedEvent
  | MessageDeletedEvent
  | ReloadEvent;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export interface APIErrorBody {
  code: string;
  message: string;
  data?: unknown;
}
