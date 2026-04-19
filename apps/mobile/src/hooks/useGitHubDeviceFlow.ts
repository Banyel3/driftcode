/**
 * useGitHubDeviceFlow
 *
 * Manages the GitHub Device Authorization Flow lifecycle.
 *
 * Usage:
 *   const { state, start, cancel } = useGitHubDeviceFlow();
 *
 * Call start() to kick off the flow — it fetches a device code, opens
 * github.com/login/device in the browser, and polls in the background.
 * When the user authorizes, the access token is stored in SecureStore via
 * the Zustand store and state returns to 'idle'.
 *
 * Call cancel() to abort polling and reset to idle (e.g. when the modal closes).
 */
import { useState, useRef, useCallback } from 'react';
import { openBrowserAsync } from 'expo-web-browser';
import {
  requestDeviceCode,
  pollForAccessToken,
  GitHubDeviceFlowError,
} from '@driftcode/github-client';
import { useConnectionStore } from '../store';

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type DeviceFlowState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | {
      phase: 'pending';
      userCode: string;
      verificationUri: string;
    }
  | { phase: 'error'; message: string };

const CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? '';
const SCOPE = 'repo read:user';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGitHubDeviceFlow() {
  const setGithubToken = useConnectionStore((s) => s.setGithubToken);

  const [state, setState] = useState<DeviceFlowState>({ phase: 'idle' });

  // Abort flag — flipped to true when cancel() is called or component unmounts.
  const cancelledRef = useRef(false);
  // Holds the current polling timeout so we can clear it on cancel.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Internal: polling loop ───────────────────────────────────────────────

  const startPolling = useCallback(
    (clientId: string, deviceCode: string, intervalSecs: number) => {
      // Guard: don't start if already cancelled
      if (cancelledRef.current) return;

      const poll = (currentInterval: number) => {
        timeoutRef.current = setTimeout(async () => {
          if (cancelledRef.current) return;

          try {
            const token = await pollForAccessToken(clientId, deviceCode);
            if (cancelledRef.current) return;
            // Success — store token, reset state
            setGithubToken(token);
            setState({ phase: 'idle' });
          } catch (err: unknown) {
            if (cancelledRef.current) return;

            if (err instanceof GitHubDeviceFlowError) {
              switch (err.code) {
                case 'authorization_pending':
                  // Normal — keep polling at same interval
                  poll(currentInterval);
                  break;

                case 'slow_down':
                  // GitHub asks us to back off by 5 seconds
                  poll(currentInterval + 5);
                  break;

                case 'expired_token':
                  setState({
                    phase: 'error',
                    message: 'The code expired. Tap "Try Again" to get a new one.',
                  });
                  break;

                case 'access_denied':
                  setState({
                    phase: 'error',
                    message: 'Authorization was denied. You can try again anytime.',
                  });
                  break;

                default:
                  setState({
                    phase: 'error',
                    message: 'Something went wrong. Tap "Try Again" to retry.',
                  });
              }
            } else {
              // Network error — keep retrying silently
              poll(currentInterval);
            }
          }
        }, currentInterval * 1000);
      };

      poll(intervalSecs);
    },
    [setGithubToken],
  );

  // ── start ────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!CLIENT_ID) {
      setState({ phase: 'error', message: 'GitHub client ID is not configured.' });
      return;
    }

    // Reset abort flag and clear any lingering timeout
    cancelledRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setState({ phase: 'loading' });

    try {
      const { deviceCode, userCode, verificationUri, interval } =
        await requestDeviceCode(CLIENT_ID, SCOPE);

      if (cancelledRef.current) return;

      setState({ phase: 'pending', userCode, verificationUri });

      // Open the verification URL in the browser (non-blocking)
      void openBrowserAsync(verificationUri);

      // Begin polling in the background
      startPolling(CLIENT_ID, deviceCode, interval);
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      const message =
        err instanceof Error
          ? err.message
          : 'Could not reach GitHub. Check your internet connection.';
      setState({ phase: 'error', message });
    }
  }, [startPolling]);

  // ── cancel ───────────────────────────────────────────────────────────────

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState({ phase: 'idle' });
  }, []);

  // ── Result ───────────────────────────────────────────────────────────────

  return { state, start, cancel };
}
