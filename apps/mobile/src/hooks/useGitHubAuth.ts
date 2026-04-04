/**
 * useGitHubAuth
 *
 * Manages GitHub sign-in using the GitHub Device Flow
 * (https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
 *
 * Why Device Flow instead of Authorization Code + Expo proxy?
 *   expo-auth-session v7 (Expo SDK 54) removed the useProxy / auth.expo.io
 *   integration entirely. Device Flow requires no redirect URI, no client
 *   secret, and works reliably in both Expo Go and standalone builds.
 *
 * Prerequisites (one-time GitHub setup):
 *   In your GitHub OAuth App settings → check "Enable Device Flow".
 *
 * Flow:
 *   1. connect() → POST /login/device/code → get user_code + device_code
 *   2. Browser opens github.com/login/device automatically
 *   3. User types the 9-char code and clicks Authorize
 *   4. Hook polls /login/oauth/access_token until success or expiry
 *   5. Token stored in SecureStore via Zustand
 *
 * Architecture rule: all GitHub API calls go through @driftcode/github-client.
 * Token is stored only in Expo SecureStore via Zustand (never in plain state).
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { createGitHubClient, getAuthenticatedUser } from '@driftcode/github-client';
import type { GitHubUser } from '@driftcode/github-client';
import { useConnectionStore } from '../store';
import { GITHUB_OAUTH } from '../constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UseGitHubAuthResult {
  /** Kick off the GitHub Device Flow */
  connect: () => Promise<void>;
  /** Cancel a Device Flow in progress */
  cancel: () => void;
  /** Remove stored token and clear user state */
  disconnect: () => void;
  /** Authenticated GitHub user — null if not connected */
  user: GitHubUser | null;
  /** True while the Device Flow or user fetch is in progress */
  isLoading: boolean;
  /** Last error message, if any */
  error: string | null;
  /** 9-char code the user must enter on github.com/login/device (non-null while flow is active) */
  userCode: string | null;
  /** Verification URL — always https://github.com/login/device while flow is active */
  verificationUri: string | null;
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
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopPolling();
    };
  }, [stopPolling]);

  const fetchUser = useCallback(async (token: string) => {
    try {
      const client = createGitHubClient({ token });
      const ghUser = await getAuthenticatedUser(client);
      setUser(ghUser);
    } catch {
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

  // ── cancel ────────────────────────────────────────────────────────────────

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stopPolling();
    setUserCode(null);
    setVerificationUri(null);
    setIsLoading(false);
    setError(null);
  }, [stopPolling]);

  // ── connect ───────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (!GITHUB_OAUTH.CLIENT_ID) {
      setError(
        'GitHub OAuth is not configured. Set EXPO_PUBLIC_GITHUB_CLIENT_ID in apps/mobile/.env.local',
      );
      return;
    }

    cancelledRef.current = false;
    stopPolling();
    setError(null);
    setUserCode(null);
    setVerificationUri(null);
    setIsLoading(true);

    // ── Step 1: Request device & user codes ─────────────────────────────────
    let deviceCode: string;
    let intervalMs: number;
    let expiresAt: number;

    try {
      const dcRes = await fetch(DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          client_id: GITHUB_OAUTH.CLIENT_ID,
          scope: GITHUB_OAUTH.SCOPES.join(' '),
        }).toString(),
      });

      const dcData = (await dcRes.json()) as {
        device_code?: string;
        user_code?: string;
        verification_uri?: string;
        expires_in?: number;
        interval?: number;
        error?: string;
        error_description?: string;
      };

      if (!dcData.device_code || !dcData.user_code || !dcData.verification_uri) {
        const hint =
          dcData.error === 'not_supported'
            ? ' Make sure "Device Flow" is enabled in your GitHub OAuth App settings at github.com/settings/developers.'
            : '';
        setError(
          (dcData.error_description ?? dcData.error ?? 'Failed to start GitHub sign-in.') + hint,
        );
        setIsLoading(false);
        return;
      }

      deviceCode = dcData.device_code;
      intervalMs = (dcData.interval ?? 5) * 1000;
      expiresAt = Date.now() + (dcData.expires_in ?? 900) * 1000;

      setUserCode(dcData.user_code);
      setVerificationUri(dcData.verification_uri);

      // Open the browser automatically so the user can enter the code
      void WebBrowser.openBrowserAsync(dcData.verification_uri);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start GitHub sign-in.');
      setIsLoading(false);
      return;
    }

    // ── Step 2: Poll for the access token ────────────────────────────────────

    const poll = async (): Promise<void> => {
      if (cancelledRef.current) return;

      if (Date.now() > expiresAt) {
        setError('The authorization code expired. Please try again.');
        setUserCode(null);
        setVerificationUri(null);
        setIsLoading(false);
        return;
      }

      try {
        const tokenRes = await fetch(ACCESS_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({
            client_id: GITHUB_OAUTH.CLIENT_ID,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }).toString(),
        });

        const tokenData = (await tokenRes.json()) as {
          access_token?: string;
          error?: string;
          interval?: number;
          error_description?: string;
        };

        if (cancelledRef.current) return;

        if (tokenData.access_token) {
          // Success — store token and fetch user profile
          setGithubToken(tokenData.access_token);
          await fetchUser(tokenData.access_token);
          setUserCode(null);
          setVerificationUri(null);
          setIsLoading(false);
          return;
        }

        switch (tokenData.error) {
          case 'authorization_pending':
            // User hasn't acted yet — keep polling at the same interval
            pollTimerRef.current = setTimeout(() => { void poll(); }, intervalMs);
            break;

          case 'slow_down':
            // GitHub asks us to back off; response includes new interval (seconds)
            if (tokenData.interval !== undefined) {
              intervalMs = tokenData.interval * 1000;
            } else {
              intervalMs += 5_000;
            }
            pollTimerRef.current = setTimeout(() => { void poll(); }, intervalMs);
            break;

          case 'expired_token':
            setError('The authorization code expired. Please try again.');
            setUserCode(null);
            setVerificationUri(null);
            setIsLoading(false);
            break;

          case 'access_denied':
            setError('GitHub authorization was denied.');
            setUserCode(null);
            setVerificationUri(null);
            setIsLoading(false);
            break;

          default:
            setError(
              tokenData.error_description ?? tokenData.error ?? 'GitHub auth failed.',
            );
            setUserCode(null);
            setVerificationUri(null);
            setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : 'GitHub auth failed.');
          setUserCode(null);
          setVerificationUri(null);
          setIsLoading(false);
        }
      }
    };

    // Start the first poll after the initial interval
    pollTimerRef.current = setTimeout(() => { void poll(); }, intervalMs);
  }, [fetchUser, setGithubToken, stopPolling]);

  // ── disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    setGithubToken(null);
    setUser(null);
    setError(null);
  }, [setGithubToken]);

  // ── Result ────────────────────────────────────────────────────────────────

  return {
    connect,
    cancel,
    disconnect,
    user,
    isLoading,
    error,
    userCode,
    verificationUri,
  };
}
