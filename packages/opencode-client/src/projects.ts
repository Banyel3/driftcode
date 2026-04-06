import type { OpenCodeClient } from './client';
import type { Project, VCSInfo, InstancePathInfo } from './types';

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
