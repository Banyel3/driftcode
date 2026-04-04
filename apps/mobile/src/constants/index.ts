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

// GitHub OAuth — credentials come from .env.local (never committed)
// CLIENT_ID is safe to bundle (EXPO_PUBLIC_ prefix makes it available at runtime)
// CLIENT_SECRET is inlined by Metro at build/start time only — do not log it
export const GITHUB_OAUTH = {
  CLIENT_ID: process.env['EXPO_PUBLIC_GITHUB_CLIENT_ID'] ?? '',
  CLIENT_SECRET: process.env['GITHUB_CLIENT_SECRET'] ?? '',
  SCOPES: ['repo', 'read:user'],
  /** Deep-link scheme defined in app.json */
  REDIRECT_URI: 'driftcode://github-callback',
} as const;
