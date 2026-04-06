import type { Session, Project } from '@driftcode/opencode-client';
import type { ActiveProject } from '../store';
import { basenameSafe } from './path';

function trimTrailingSlash(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '/') return '/';
  return trimmed.replace(/\/+$/, '');
}

export function normalizePath(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null;
  const cleaned = trimTrailingSlash(path);
  return cleaned.length > 0 ? cleaned : null;
}

export function getProjectWorktree(project: Project): string | null {
  const candidate =
    (project as { worktree?: string | null }).worktree ??
    (project as { path?: string | null }).path ??
    null;
  return normalizePath(candidate);
}

export function getSessionWorktree(session: Session): string | null {
  const candidate =
    (session as { worktree?: string | null }).worktree ??
    (session as { path?: string | null }).path ??
    null;
  return normalizePath(candidate);
}

export function pathsMatch(sessionPath: string | null, worktree: string | null): boolean {
  const s = normalizePath(sessionPath);
  const w = normalizePath(worktree);
  if (!s || !w) return false;
  return s === w || s.startsWith(`${w}/`) || w.startsWith(`${s}/`);
}

export function getActiveProjectWorktree(activeProject: ActiveProject | null): string | null {
  if (!activeProject) return null;
  if (activeProject.kind === 'server') {
    return getProjectWorktree(activeProject.project);
  }
  return normalizePath(activeProject.resolvedWorktree ?? null);
}

function matchesRepoName(path: string | null, repoName: string): boolean {
  if (!path) return false;
  const base = basenameSafe(path)?.toLowerCase();
  return base === repoName.toLowerCase();
}

export function sessionMatchesActiveProject(
  session: Session,
  activeProject: ActiveProject | null,
): boolean {
  if (!activeProject) return true;

  const sessionPath = getSessionWorktree(session);
  if (!sessionPath) return false;

  if (activeProject.kind === 'server') {
    return pathsMatch(sessionPath, getProjectWorktree(activeProject.project));
  }

  const byResolved = pathsMatch(sessionPath, activeProject.resolvedWorktree ?? null);
  const byRepoName = matchesRepoName(sessionPath, activeProject.repo.name);
  return byResolved || byRepoName;
}

export function projectMatchesActiveProject(
  project: Project,
  activeProject: ActiveProject | null,
): boolean {
  if (!activeProject || activeProject.kind !== 'github') return false;
  const worktree = getProjectWorktree(project);
  if (!worktree) return false;
  return matchesRepoName(worktree, activeProject.repo.name);
}
