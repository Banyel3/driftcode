/**
 * GitHub Device Authorization Flow
 *
 * Implements the two-step device flow for mobile OAuth:
 *   1. requestDeviceCode  — get a user-facing code + start polling
 *   2. pollForAccessToken — called on an interval until authorized or expired
 *
 * No client secret required. Designed for public clients (mobile apps, CLIs).
 * Same flow used by GitHub CLI and VS Code.
 *
 * Refs:
 *   https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;         // shown to user, e.g. "XXXX-XXXX"
  verificationUri: string;  // "https://github.com/login/device"
  expiresIn: number;        // seconds until the code expires (usually 900)
  interval: number;         // minimum polling interval in seconds (usually 5)
}

export type DeviceFlowErrorCode =
  | 'authorization_pending' // user hasn't acted yet — keep polling
  | 'slow_down'             // polling too fast — increase interval by 5s
  | 'expired_token'         // code expired; must restart
  | 'access_denied';        // user explicitly denied

export class GitHubDeviceFlowError extends Error {
  constructor(public readonly code: DeviceFlowErrorCode) {
    super(code);
    this.name = 'GitHubDeviceFlowError';
  }
}

// ---------------------------------------------------------------------------
// Step 1 — Request a device code
// ---------------------------------------------------------------------------

export async function requestDeviceCode(
  clientId: string,
  scope: string,
): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({ client_id: clientId, scope });

  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`GitHub device code request failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
  };

  if (data.error || !data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error(data.error ?? 'Unexpected response from GitHub device code endpoint.');
  }

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in ?? 900,
    interval: data.interval ?? 5,
  };
}

// ---------------------------------------------------------------------------
// Step 2 — Single poll attempt
//
// Returns the access token on success.
// Throws GitHubDeviceFlowError with the appropriate code otherwise so the
// caller can decide whether to keep polling or surface an error.
// ---------------------------------------------------------------------------

export async function pollForAccessToken(
  clientId: string,
  deviceCode: string,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`GitHub token poll failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
  };

  if (data.access_token) {
    return data.access_token;
  }

  const code = data.error as DeviceFlowErrorCode | undefined;
  throw new GitHubDeviceFlowError(code ?? 'authorization_pending');
}
