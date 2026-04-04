/**
 * useGitHubAuth
 *
 * Manages the GitHub OAuth PKCE flow via Expo AuthSession.
 * - connect()    — launches the browser-based OAuth flow and stores the token
 * - disconnect() — clears the token from the store and SecureStore
 * - user         — the authenticated GitHubUser (fetched after connect)
 *
 * Architecture rule: all GitHub API calls go through @driftcode/github-client.
 * Token is stored only in Expo SecureStore via Zustand (never in plain state).
 */
import { useState, useCallback, useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { createGitHubClient, getAuthenticatedUser } from '@driftcode/github-client';
import type { GitHubUser } from '@driftcode/github-client';
import { useConnectionStore } from '../store';
import { GITHUB_OAUTH } from '../constants';

// Required for Expo AuthSession on Android to complete the auth flow
WebBrowser.maybeCompleteAuthSession();

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UseGitHubAuthResult {
  /** Kick off the GitHub OAuth PKCE flow */
  connect: () => Promise<void>;
  /** Remove stored token and clear user state */
  disconnect: () => void;
  /** Authenticated GitHub user — null if not connected */
  user: GitHubUser | null;
  /** True while the OAuth flow or user fetch is in progress */
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

  // Build the PKCE auth request
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'driftcode' });

  const discovery = {
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
  };

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GITHUB_OAUTH.CLIENT_ID,
      scopes: [...GITHUB_OAUTH.SCOPES],
      redirectUri,
      // GitHub supports PKCE only for device flow; use implicit-style with
      // code exchange via a proxy when CLIENT_SECRET is not in the app.
      // For Expo Go without a secret, we request the code and exchange via
      // the Expo proxy (auth.expo.io) OR handle it as code-only.
      responseType: AuthSession.ResponseType.Code,
      usePKCE: false,
    },
    discovery,
  );

  // ── Fetch GitHub user profile once we have a token ──────────────────────
  const fetchUser = useCallback(async (token: string) => {
    try {
      const client = createGitHubClient({ token });
      const ghUser = await getAuthenticatedUser(client);
      setUser(ghUser);
    } catch {
      // Token may be invalid; clear it
      setUser(null);
    }
  }, []);

  // Re-hydrate user when the token is already stored (app restart)
  useEffect(() => {
    if (githubToken && !user) {
      void fetchUser(githubToken);
    } else if (!githubToken) {
      setUser(null);
    }
  }, [githubToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle the OAuth response from the browser
  useEffect(() => {
    if (response?.type === 'success' && response.params['code']) {
      const code = response.params['code'];
      // Exchange code for token via Expo's auth proxy (no client secret in app)
      // The token endpoint returns form-encoded data
      void (async () => {
        setIsLoading(true);
        setError(null);
        try {
          const tokenRes = await fetch(
            'https://github.com/login/oauth/access_token',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
              },
              body: new URLSearchParams({
                client_id: GITHUB_OAUTH.CLIENT_ID,
                code,
                redirect_uri: redirectUri,
              }).toString(),
            },
          );
          const tokenData = (await tokenRes.json()) as {
            access_token?: string;
            error?: string;
            error_description?: string;
          };
          if (tokenData.access_token) {
            setGithubToken(tokenData.access_token);
            await fetchUser(tokenData.access_token);
          } else {
            setError(
              tokenData.error_description ??
                tokenData.error ??
                'GitHub auth failed.',
            );
          }
        } catch (err: unknown) {
          setError(
            err instanceof Error ? err.message : 'GitHub auth failed.',
          );
        } finally {
          setIsLoading(false);
        }
      })();
    } else if (response?.type === 'error') {
      setError(response.error?.message ?? 'GitHub auth was cancelled.');
    }
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public actions ────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (!GITHUB_OAUTH.CLIENT_ID) {
      setError(
        'GitHub OAuth is not configured. Set EXPO_PUBLIC_GITHUB_CLIENT_ID.',
      );
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await promptAsync();
    } finally {
      // isLoading is cleared in the response useEffect
      setIsLoading(false);
    }
  }, [promptAsync]);

  const disconnect = useCallback(() => {
    setGithubToken(null);
    setUser(null);
    setError(null);
  }, [setGithubToken]);

  return {
    connect,
    disconnect,
    user,
    isLoading: isLoading || (request === null && githubToken === null ? false : false),
    error,
  };
}
