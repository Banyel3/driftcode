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
  projectID?: string;
  directory?: string | null;
  title?: string | null;
  parentId?: string | null;
  model?: string | null;
  /** Absolute path to the project directory on the server */
  path?: string | null;
  /** Newer opencode servers use worktree instead of path */
  worktree?: string | null;
  createdAt: number;
  updatedAt: number;
  time?: {
    created: number;
    updated: number;
  };
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
  name?: string;
  path: string;
  absolute?: string;
  type: 'file' | 'directory';
  ignored?: boolean;
  children?: FileEntry[];
}

export interface FileContentResponse {
  type: 'text' | 'binary';
  content: string;
  diff?: string;
  patch?: unknown;
  mimeType?: string;
  encoding?: string;
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
  /** Canonical project root path on newer opencode servers */
  worktree?: string;
  /** Legacy project root path on older opencode servers */
  path?: string;
  name?: string;
}

export interface FileDiff {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
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

export interface InstancePathInfo {
  home: string;
  state: string;
  config: string;
  worktree: string;
  directory: string;
}

// ---------------------------------------------------------------------------
// SSE Events
// ---------------------------------------------------------------------------
export type EventType =
  | 'session.updated'
  | 'session.deleted'
  | 'message.updated'
  | 'message.deleted'
  | 'message.removed'
  | 'message.part.updated'
  | 'message.part.removed'
  | 'message.part.delta'
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
  properties:
    | {
      sessionId: string;
      message: Message;
    }
    | {
      sessionID: string;
      info: Message;
    };
}

export interface MessageDeletedEvent {
  type: 'message.deleted';
  properties: {
    sessionId: string;
    messageId: string;
  };
}

export interface MessageRemovedEvent {
  type: 'message.removed';
  properties: {
    sessionID: string;
    messageID: string;
  };
}

export interface MessagePartUpdatedEvent {
  type: 'message.part.updated';
  properties: {
    part: unknown;
    delta?: string;
  };
}

export interface MessagePartRemovedEvent {
  type: 'message.part.removed';
  properties: {
    sessionID: string;
    messageID: string;
    partID: string;
  };
}

export interface MessagePartDeltaEvent {
  type: 'message.part.delta';
  properties: {
    messageID: string;
    partID: string;
    field: string;
    delta: string;
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
  | MessageRemovedEvent
  | MessagePartUpdatedEvent
  | MessagePartRemovedEvent
  | MessagePartDeltaEvent
  | ReloadEvent;

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** A slash command available on the connected opencode server. */
export interface Command {
  /** Command name without the leading slash, e.g. "init", "undo", "help" */
  name: string;
  /** Human-readable description shown in the autocomplete list */
  description?: string;
  /** Whether this is a built-in command or user-defined */
  type?: 'builtin' | 'user';
}

export interface ExecuteCommandRequest {
  /** Command name without the leading slash */
  command: string;
  /** Everything typed after the command name */
  arguments: string;
  messageID?: string;
  agent?: string;
  model?: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export interface APIErrorBody {
  code: string;
  message: string;
  data?: unknown;
}
