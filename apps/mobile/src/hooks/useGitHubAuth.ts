/**
 * useGitHubAuth
 *
 * PAT-based GitHub integration — no OAuth App, no redirect URI, no browser dance.
 *
 * Usage:
 *   1. User generates a classic Personal Access Token on GitHub with scopes:
 *        repo, read:user
 *   2. User pastes the token into the Settings modal.
 *   3. connect(token) validates it by calling GET /user, then persists it.
 *
 * Architecture rule: all GitHub API calls go through @driftcode/github-client.
 * Token is stored only in Expo SecureStore via Zustand (never in plain state).
 */
import { useState, useCallback, useEffect } from 'react';
import { createGitHubClient, getAuthenticatedUser } from '@driftcode/github-client';
import type { GitHubUser } from '@driftcode/github-client';
import { useConnectionStore } from '../store';
import { queryClient } from '../providers/QueryProvider';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

const GITHUB_TIMEOUT_MS = 20_000;

function getErrorStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const maybeStatus = (err as { status?: unknown }).status;
  return typeof maybeStatus === 'number' ? maybeStatus : null;
}

function isAuthInvalidError(err: unknown): boolean {
  const status = getErrorStatus(err);
  if (status === 401 || status === 403) return true;

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('bad credentials') || msg.includes('requires authentication');
  }

  return false;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error('GitHub request timed out. Check your internet connection.')),
        ms,
      )
    ),
  ]);
}

export interface UseGitHubAuthResult {
  /**
   * Validate and persist a Personal Access Token.
   * Calls GET /user — if it succeeds the token is stored; if not, an error is set.
   */
  connect: (token: string) => Promise<void>;
  /** Remove stored token and clear user state */
  disconnect: () => void;
  /** Authenticated GitHub user — null if not connected */
  user: GitHubUser | null;
  /** True while the validation fetch is in progress */
  isLoading: boolean;
  /** Last error message, if any */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGitHubAuth(): UseGitHubAuthResult {
  const githubToken = useConnectionStore((s) => s.githubToken);
  const setGithubToken = useConnectionStore((s) => s.setGithubToken);
  const disconnectGitHub = useConnectionStore((s) => s.disconnectGitHub);

  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fetchUser = useCallback(async (token: string): Promise<GitHubUser | null> => {
    const client = createGitHubClient({ token });
    return getAuthenticatedUser(client);
  }, []);

  // Re-hydrate user when the token is already stored (app restart)
  useEffect(() => {
    if (githubToken && !user) {
      setIsLoading(true);
      withTimeout(fetchUser(githubToken), GITHUB_TIMEOUT_MS)
        .then((ghUser) => {
          setUser(ghUser);
          setError(null);
        })
        .catch((err: unknown) => {
          // Only wipe the persisted token for explicit auth failures.
          // Network/timeout errors are transient and should not log the user out.
          if (isAuthInvalidError(err)) {
            disconnectGitHub();
            queryClient.removeQueries({ queryKey: ['githubRepos'] });
            queryClient.removeQueries({ queryKey: ['githubBranches'] });
            queryClient.removeQueries({ queryKey: ['sessions'] });
            queryClient.removeQueries({ queryKey: ['messages'] });
            setUser(null);
            setError('Stored GitHub token is no longer valid. Please reconnect.');
            return;
          }

          setUser(null);
          setError('Could not verify GitHub connection right now. Your saved PAT was kept.');
        })
        .finally(() => { setIsLoading(false); });
    } else if (!githubToken) {
      setUser(null);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubToken]);

  // ── connect ───────────────────────────────────────────────────────────────

  const connect = useCallback(async (token: string) => {
    const trimmed = token.trim();
    if (!trimmed) {
      setError('Please enter a Personal Access Token.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const ghUser = await withTimeout(fetchUser(trimmed), GITHUB_TIMEOUT_MS);
      // Token is valid — persist and set user
      setGithubToken(trimmed);
      setUser(ghUser);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.includes('timed out')
          ? err.message
          : isAuthInvalidError(err)
            ? 'GitHub rejected this token. Make sure it is a classic PAT with repo and read:user scopes.'
            : 'Could not reach GitHub to verify this token. Check your internet and try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUser, setGithubToken]);

  // ── disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    // Wipe GitHub token + all session/project ephemeral state from the store
    disconnectGitHub();
    // Clear all GitHub and session-related TanStack Query caches
    queryClient.removeQueries({ queryKey: ['githubRepos'] });
    queryClient.removeQueries({ queryKey: ['githubBranches'] });
    queryClient.removeQueries({ queryKey: ['sessions'] });
    queryClient.removeQueries({ queryKey: ['messages'] });
    setUser(null);
    setError(null);
  }, [disconnectGitHub]);

  // ── Result ────────────────────────────────────────────────────────────────

  return {
    connect,
    disconnect,
    user,
    isLoading,
    error,
  };
}
