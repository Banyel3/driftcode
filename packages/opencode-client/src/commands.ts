import type { OpenCodeClient } from './client';
import type { Command, ExecuteCommandRequest, Message } from './types';

// Long-running commands (e.g. /init which runs AI analysis) can take a while.
const COMMAND_TIMEOUT_MS = 120_000;

/**
 * GET /command
 * Returns all commands available on the server: built-in commands
 * (init, undo, redo, share, help, …) plus any user-defined custom commands.
 */
export async function listCommands(client: OpenCodeClient): Promise<Command[]> {
  return client.get<Command[]>('/command');
}

/**
 * POST /session/:id/command
 * Executes a slash command synchronously and returns the resulting message.
 * Use for commands like /undo, /redo, /init, /help, /share, and any
 * custom commands defined in the project's .opencode/commands/ directory.
 */
export async function executeCommand(
  client: OpenCodeClient,
  sessionId: string,
  request: ExecuteCommandRequest,
): Promise<Message> {
  return client.post<Message>(
    `/session/${sessionId}/command`,
    request,
    COMMAND_TIMEOUT_MS,
  );
}
