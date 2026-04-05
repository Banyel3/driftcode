/**
 * useSSEStream
 *
 * Connects to the opencode global SSE endpoint (GET /event) using the
 * fetch-based streaming API available in React Native / Hermes.
 *
 * Why not EventSource?  React Native's built-in EventSource implementation
 * does not support custom request headers (needed for Basic Auth). We
 * implement the same text/event-stream parsing manually using the Streams API.
 */
import { useEffect, useRef, useCallback } from 'react';
import { createOpenCodeClient } from '@driftcode/opencode-client';
import type { OpenCodeEvent } from '@driftcode/opencode-client';
import { useConnectionStore } from '../store';

function readSSEBlocks(buffer: string): { blocks: string[]; rest: string } {
  const blocks: string[] = [];
  let rest = buffer;

  while (true) {
    const lfIdx = rest.indexOf('\n\n');
    const crlfIdx = rest.indexOf('\r\n\r\n');

    let sepIdx = -1;
    let sepLen = 0;

    if (lfIdx !== -1 && (crlfIdx === -1 || lfIdx < crlfIdx)) {
      sepIdx = lfIdx;
      sepLen = 2;
    } else if (crlfIdx !== -1) {
      sepIdx = crlfIdx;
      sepLen = 4;
    }

    if (sepIdx === -1) break;

    blocks.push(rest.slice(0, sepIdx));
    rest = rest.slice(sepIdx + sepLen);
  }

  return { blocks, rest };
}

function parseSSEData(block: string): string | null {
  const lines = block.split(/\r?\n/);
  const dataLines = lines
    .map((line) => line.trimStart())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart());

  if (dataLines.length === 0) return null;
  return dataLines.join('\n').trim();
}

export interface SSEStreamOptions {
  /** Called for every parsed OpenCodeEvent. */
  onEvent: (event: OpenCodeEvent) => void;
  /** Called when the connection drops or an unrecoverable error occurs. */
  onError?: (err: Error) => void;
  /** Called when a reconnect attempt successfully re-establishes stream. */
  onReconnect?: () => void;
  /** Whether to actively hold the connection open. */
  enabled: boolean;
}

/**
 * Maintains a persistent SSE connection to the opencode server for as long as
 * `enabled` is true.  Reconnects with exponential back-off on failure.
 */
export function useSSEStream({ onEvent, onError, onReconnect, enabled }: SSEStreamOptions): void {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  // Stable refs so the reconnect loop doesn't need to close over stale values.
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  const onReconnectRef = useRef(onReconnect);
  onEventRef.current = onEvent;
  onErrorRef.current = onError;
  onReconnectRef.current = onReconnect;

  // AbortController for the active fetch — we replace it on each attempt.
  const abortRef = useRef<AbortController | null>(null);
  const retryDelayRef = useRef(1000);
  const isMountedRef = useRef(true);
  const hasConnectedOnceRef = useRef(false);

  const connect = useCallback(async () => {
    if (!serverUrl || !serverPassword) return;

    const client = createOpenCodeClient({
      serverUrl,
      username: serverUsername,
      password: serverPassword,
    });

    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      const response = await fetch(client.getEventStreamUrl(), {
        method: 'GET',
        headers: {
          Authorization: client.getAuthHeader(),
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal,
        // React Native: disable body compression so we get raw bytes back
        // @ts-ignore - RN-specific fetch option
        reactNative: { textStreaming: true },
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: HTTP ${response.status}`);
      }

      if (hasConnectedOnceRef.current) {
        onReconnectRef.current?.();
      }
      hasConnectedOnceRef.current = true;

      // Reset back-off on successful connect.
      retryDelayRef.current = 1000;

      const reader = response.body?.getReader();
      if (!reader) throw new Error('SSE: no readable body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const { blocks, rest } = readSSEBlocks(buffer);
        buffer = rest;

        for (const block of blocks) {
          const jsonStr = parseSSEData(block);
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr) as OpenCodeEvent;
            onEventRef.current(event);
          } catch {
            // Silently skip malformed events.
          }
        }
      }

      // Some servers/proxies close SSE streams periodically. Reconnect.
      throw new Error('SSE stream ended');
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return;

      const error = err instanceof Error ? err : new Error(String(err));
      onErrorRef.current?.(error);

      // Exponential back-off, capped at 30 s.
      if (isMountedRef.current) {
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, 30_000);
        setTimeout(() => {
          if (isMountedRef.current) {
            void connect();
          }
        }, delay);
      }
    }
  }, [serverUrl, serverUsername, serverPassword]);

  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      void connect();
    }

    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [enabled, connect]);
}
