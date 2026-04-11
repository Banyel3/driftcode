import type { OpenCodeClient } from './client';
import type { Project, VCSInfo, InstancePathInfo } from './types';
import { createSession, deleteSession } from './sessions';
import { listCommands, executeCommand } from './commands';

function assertSafeBranchName(branch: string): string {
  const trimmed = branch.trim();
  if (!trimmed) {
    throw new Error('Branch name cannot be empty.');
  }
  if (!/^[A-Za-z0-9._\/-]+$/.test(trimmed) || trimmed.includes('..')) {
    throw new Error('Invalid branch name.');
  }
  return trimmed;
}

/**
 * GET /project
 * Returns all projects (cloned repos) known to the server.
 */
export async function listProjects(
  client: OpenCodeClient,
): Promise<Project[]> {
  return client.get<Project[]>('/project');
}

/**
 * GET /project/current
 * Returns the currently active project.
 */
export async function getCurrentProject(
  client: OpenCodeClient,
): Promise<Project> {
  return client.get<Project>('/project/current');
}

/**
 * GET /vcs
 * Returns VCS (git) info for the current project: branch, remote URL, dirty state.
 */
export async function getVCSInfo(client: OpenCodeClient): Promise<VCSInfo> {
  return client.get<VCSInfo>('/vcs');
}

/**
 * GET /path
 * Returns current instance path context, including active worktree.
 */
export async function getInstancePathInfo(
  client: OpenCodeClient,
): Promise<InstancePathInfo> {
  return client.get<InstancePathInfo>('/path');
}

/**
 * Switches a git branch for a specific server worktree by executing
 * git commands inside a temporary session rooted at that path.
 */
export async function switchProjectBranch(
  client: OpenCodeClient,
  worktreePath: string,
  branch: string,
): Promise<void> {
  const safeBranch = assertSafeBranchName(branch);
  const session = await createSession(client, { path: worktreePath });

  try {
    const commands = await listCommands(client).catch(() => []);
    const commandNames = new Set(commands.map((c) => c.name.toLowerCase()));
    const execCommand = commandNames.has('bash')
      ? 'bash'
      : commandNames.has('sh')
        ? 'sh'
        : null;

    if (!execCommand) {
      throw new Error(
        'Server does not expose shell commands for branch switching. Ensure /bash or /sh is available in opencode.',
      );
    }

    try {
      await executeCommand(client, session.id, {
        command: execCommand,
        arguments: `git switch ${safeBranch}`,
      });
      return;
    } catch {
      await executeCommand(client, session.id, {
        command: execCommand,
        arguments: `git checkout ${safeBranch}`,
      });
    }
  } finally {
    await deleteSession(client, session.id).catch(() => undefined);
  }
}
