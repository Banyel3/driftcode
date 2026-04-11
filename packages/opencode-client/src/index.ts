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
  FileContentResponse,
  ModelInfo,
  ProviderInfo,
  ConfigProvidersResponse,
  AgentInfo,
  Project,
  VCSInfo,
  InstancePathInfo,
  FileDiff,
  Command,
  ExecuteCommandRequest,
  OpenCodeEvent,
  SessionUpdatedEvent,
  SessionDeletedEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  MessageRemovedEvent,
  MessagePartUpdatedEvent,
  MessagePartRemovedEvent,
  MessagePartDeltaEvent,
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
  getSessionDiff,
  shareSession,
  unshareSession,
  forkSession,
  revertSession,
  unrevertSession,
} from './sessions';

export {
  getMessages,
  sendMessage,
  sendMessageAsync,
  normalizeIncomingMessage,
  normalizeIncomingMessages,
  normalizeIncomingPart,
} from './messages';

export { listFiles, getFileContent, findFiles } from './files';

export {
  listProviders,
  getConfiguredProviders,
  listAgents,
  setProviderAuth,
} from './providers';

export {
  listProjects,
  getCurrentProject,
  getVCSInfo,
  getInstancePathInfo,
  switchProjectBranch,
} from './projects';

export { listCommands, executeCommand } from './commands';
