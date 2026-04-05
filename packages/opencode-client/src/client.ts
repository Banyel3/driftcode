import type { APIErrorBody } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 10_000;

export interface OpenCodeClientConfig {
  serverUrl: string;
  username: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------
export class OpenCodeAPIError extends Error {
  readonly status: number;
  readonly code: string;
  readonly data?: unknown;

  constructor(status: number, error: APIErrorBody) {
    super(error.message);
    this.name = 'OpenCodeAPIError';
    this.status = status;
    this.code = error.code;
    this.data = error.data;
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
export class OpenCodeClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(config: OpenCodeClientConfig) {
    if (typeof config.serverUrl !== 'string' || config.serverUrl.trim() === '') {
      throw new Error(
        'OpenCodeClient: serverUrl must be a non-empty string. ' +
        `Received: ${JSON.stringify(config.serverUrl)}`,
      );
    }
    this.baseUrl = config.serverUrl.replace(/\/$/, '');
    // React Native has global `btoa` since RN 0.71
    const credentials = btoa(`${config.username}:${config.password}`);
    this.authHeader = `Basic ${credentials}`;
  }

  // ── Core request helper ──────────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit = {},
    timeoutMs: number = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
          ...(options.headers as Record<string, string>),
        },
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `Request timed out after ${timeoutMs / 1_000}s. The server is taking too long to respond.`,
        );
      }
      throw err;
    }
    clearTimeout(timer);

    if (!response.ok) {
      let error: APIErrorBody;
      try {
        error = (await response.json()) as APIErrorBody;
      } catch {
        error = {
          code: `HTTP_${response.status}`,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      throw new OpenCodeAPIError(response.status, error);
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // ── HTTP verbs ───────────────────────────────────────────────────────────

  async get<T>(path: string, timeoutMs?: number): Promise<T> {
    return this.request<T>(path, { method: 'GET' }, timeoutMs ?? REQUEST_TIMEOUT_MS);
  }

  async post<T>(path: string, body?: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>(
      path,
      {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      timeoutMs ?? REQUEST_TIMEOUT_MS,
    );
  }

  async put<T>(path: string, body?: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>(
      path,
      {
        method: 'PUT',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      timeoutMs ?? REQUEST_TIMEOUT_MS,
    );
  }

  async delete<T>(path: string, timeoutMs?: number): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' }, timeoutMs ?? REQUEST_TIMEOUT_MS);
  }

  // ── SSE helpers ──────────────────────────────────────────────────────────

  /** Full URL for the global SSE event stream: GET /event */
  getEventStreamUrl(): string {
    return `${this.baseUrl}/event`;
  }

  /** The Basic Auth header value — passed to the SSE connection */
  getAuthHeader(): string {
    return this.authHeader;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createOpenCodeClient(
  config: OpenCodeClientConfig,
): OpenCodeClient {
  return new OpenCodeClient(config);
}
