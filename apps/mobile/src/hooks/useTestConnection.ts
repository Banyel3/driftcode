import { useState, useCallback } from 'react';
import { createOpenCodeClient } from '@driftcode/opencode-client';
import { getHealth } from '@driftcode/opencode-client';

export interface TestConnectionResult {
  ok: boolean;
  version?: string;
  error?: string;
}

export interface UseTestConnectionReturn {
  test: (serverUrl: string, username: string, password: string) => Promise<TestConnectionResult>;
  isLoading: boolean;
  result: TestConnectionResult | null;
}

/**
 * Hook that tests an opencode server connection by calling GET /global/health.
 * All API calls go through the opencode-client package — never fetch directly.
 */
export function useTestConnection(): UseTestConnectionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestConnectionResult | null>(null);

  const test = useCallback(
    async (serverUrl: string, username: string, password: string): Promise<TestConnectionResult> => {
      setIsLoading(true);
      setResult(null);

      // Normalise URL — strip trailing slash, ensure scheme
      let url = serverUrl.trim();
      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      url = url.replace(/\/$/, '');

      try {
        const client = createOpenCodeClient({ serverUrl: url, username, password });
        const health = await getHealth(client);
        const outcome: TestConnectionResult = { ok: true, version: health.version };
        setResult(outcome);
        return outcome;
      } catch (err: unknown) {
        let message = 'Could not connect to server.';
        if (err instanceof Error) {
          // Surface something useful without leaking internals
          if (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized')) {
            message = 'Wrong password. Check your credentials and try again.';
          } else if (err.message.includes('Network') || err.message.toLowerCase().includes('fetch')) {
            message = 'Network error. Check the URL and your internet connection.';
          } else {
            message = err.message;
          }
        }
        const outcome: TestConnectionResult = { ok: false, error: message };
        setResult(outcome);
        return outcome;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { test, isLoading, result };
}
