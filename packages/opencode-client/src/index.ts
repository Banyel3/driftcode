// Public API surface for @driftcode/opencode-client
//
// Architecture rule: ALL opencode API calls in the mobile app MUST go through
// this package. Never import from @opencode-ai/sdk directly in components.

export type {
  HealthResponse,
  Session,
  CreateSessionRequest,
  MessageRole,
  TextPart,
  ToolInvocation,
  ToolInvocationPart,
  StepStartPart,
  FilePart,
  ReasoningPart,
  MessagePart,
  Message,
  SendMessageRequest,
  FileEntry,
  ModelInfo,
  ProviderInfo,
  Project,
  VCSInfo,
  OpenCodeEvent,
  SessionUpdatedEvent,
  SessionDeletedEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  ReloadEvent,
  APIErrorBody,
} from './types';

export {
  OpenCodeClient,
  OpenCodeAPIError,
  createOpenCodeClient,
} from './client';

export type { OpenCodeClientConfig } from './client';

export { getHealth } from './health';

export {
  listSessions,
  getSession,
  createSession,
  deleteSession,
} from './sessions';

export { getMessages, sendMessage, sendMessageAsync } from './messages';

export { listFiles, getFileContent, findFiles } from './files';

export {
  listProviders,
  getConfiguredProviders,
  setProviderAuth,
} from './providers';

export { listProjects, getCurrentProject, getVCSInfo } from './projects';
