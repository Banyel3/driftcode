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

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
      fetchUser(githubToken)
        .then((ghUser) => { setUser(ghUser); })
        .catch(() => {
          // Stored token is no longer valid — wipe it so the UI shows disconnected
          setGithubToken(null);
          setUser(null);
        })
        .finally(() => { setIsLoading(false); });
    } else if (!githubToken) {
      setUser(null);
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
      const ghUser = await fetchUser(trimmed);
      // Token is valid — persist and set user
      setGithubToken(trimmed);
      setUser(ghUser);
    } catch {
      setError(
        'Could not authenticate with GitHub. Make sure the token is valid and has the repo and read:user scopes.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchUser, setGithubToken]);

  // ── disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    setGithubToken(null);
    setUser(null);
    setError(null);
  }, [setGithubToken]);

  // ── Result ────────────────────────────────────────────────────────────────

  return {
    connect,
    disconnect,
    user,
    isLoading,
    error,
  };
}
