import type { APIErrorBody } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
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
    this.baseUrl = config.serverUrl.replace(/\/$/, '');
    // React Native has global `btoa` since RN 0.71
    const credentials = btoa(`${config.username}:${config.password}`);
    this.authHeader = `Basic ${credentials}`;
  }

  // ── Core request helper ──────────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
        ...(options.headers as Record<string, string>),
      },
    });

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

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
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
