export * from './colors';
export * from './theme';

// ─── App-wide string constants ────────────────────────────────────────────────
export const APP_NAME = 'DriftCode';
export const APP_TAGLINE = 'AI Coding, Anywhere';

// Demo server maintained by DriftCode — rate-limited, no persistent storage
export const DEMO_SERVER_URL = 'https://demo.driftcode.dev';
export const DEFAULT_SERVER_USERNAME = 'opencode';
export const DEFAULT_CLONE_DIRECTORY = '~/projects/';

// Keys used with Expo SecureStore (all device-local, encrypted)
export const SECURE_STORE_KEYS = {
  SERVER_URL: 'driftcode_server_url',
  SERVER_USERNAME: 'driftcode_server_username',
  SERVER_PASSWORD: 'driftcode_server_password',
  GITHUB_TOKEN: 'driftcode_github_token',
  ONBOARDING_COMPLETE: 'driftcode_onboarding_complete',
  CLONE_DIRECTORY: 'driftcode_clone_directory',
} as const;

// GitHub OAuth — Client ID comes from app.json extra (set via EAS Secrets in CI)
export const GITHUB_OAUTH = {
  /** Override via EXPO_PUBLIC_GITHUB_CLIENT_ID env var or app.json extra */
  CLIENT_ID: process.env['EXPO_PUBLIC_GITHUB_CLIENT_ID'] ?? '',
  SCOPES: ['repo', 'read:user'],
  /** Deep-link scheme defined in app.json */
  REDIRECT_URI: 'driftcode://github-callback',
} as const;
