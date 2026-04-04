import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_KEYS, DEFAULT_SERVER_USERNAME } from '../constants';

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------
interface ConnectionState {
  // ── Server credentials (stored in SecureStore) ───────────────────────────
  serverUrl: string | null;
  serverUsername: string;
  serverPassword: string | null;

  // ── GitHub OAuth token (stored in SecureStore, NEVER sent to server) ──────
  githubToken: string | null;

  // ── Derived / ephemeral state ─────────────────────────────────────────────
  isConnected: boolean;

  /** True once the user has completed (or skipped) onboarding */
  isOnboardingComplete: boolean;

  /** Currently open session id (drives the Chat tab) */
  activeSessionId: string | null;

  /** User-configured directory for git clone operations */
  cloneDirectory: string;

  // ── Actions ───────────────────────────────────────────────────────────────
  setServerUrl: (url: string) => void;
  setServerUsername: (username: string) => void;
  setServerPassword: (password: string) => void;
  setGithubToken: (token: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  setCloneDirectory: (dir: string) => void;

  /** Marks onboarding as done and persists the flag to SecureStore */
  setOnboardingComplete: () => void;

  /** Disconnects and wipes all stored credentials */
  clearConnection: () => void;

  /**
   * Reads all persisted credentials from SecureStore on app launch.
   * Call once in App.tsx inside a useEffect.
   */
  hydrate: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
// Note: zustand v5 TypeScript pattern — double-call `create<T>()(...)` for
// correct generic inference without the `combine` helper.
export const useConnectionStore = create<ConnectionState>()((set) => ({
  serverUrl: null,
  serverUsername: DEFAULT_SERVER_USERNAME,
  serverPassword: null,
  githubToken: null,
  isConnected: false,
  isOnboardingComplete: false,
  activeSessionId: null,
  cloneDirectory: '~/projects/',

  setServerUrl: (url) => {
    set({ serverUrl: url });
    void SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_URL, url);
  },

  setServerUsername: (username) => {
    set({ serverUsername: username });
    void SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_USERNAME, username);
  },

  setServerPassword: (password) => {
    set({ serverPassword: password });
    void SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_PASSWORD, password);
  },

  setGithubToken: (token) => {
    set({ githubToken: token });
    if (token) {
      void SecureStore.setItemAsync(SECURE_STORE_KEYS.GITHUB_TOKEN, token);
    } else {
      void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.GITHUB_TOKEN);
    }
  },

  setIsConnected: (connected) => {
    set({ isConnected: connected });
  },

  setActiveSessionId: (sessionId) => {
    set({ activeSessionId: sessionId });
  },

  setCloneDirectory: (dir) => {
    set({ cloneDirectory: dir });
    void SecureStore.setItemAsync(SECURE_STORE_KEYS.CLONE_DIRECTORY, dir);
  },

  setOnboardingComplete: () => {
    set({ isOnboardingComplete: true });
    void SecureStore.setItemAsync(SECURE_STORE_KEYS.ONBOARDING_COMPLETE, 'true');
  },

  clearConnection: () => {
    set({
      serverUrl: null,
      serverUsername: DEFAULT_SERVER_USERNAME,
      serverPassword: null,
      githubToken: null,
      isConnected: false,
      activeSessionId: null,
    });
    void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.SERVER_URL);
    void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.SERVER_PASSWORD);
    void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.GITHUB_TOKEN);
  },

  hydrate: async () => {
    const [serverUrl, serverUsername, serverPassword, githubToken, cloneDir, onboardingDone] =
      await Promise.all([
        SecureStore.getItemAsync(SECURE_STORE_KEYS.SERVER_URL),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.SERVER_USERNAME),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.SERVER_PASSWORD),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.GITHUB_TOKEN),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.CLONE_DIRECTORY),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.ONBOARDING_COMPLETE),
      ]);

    set({
      serverUrl,
      serverUsername: serverUsername ?? DEFAULT_SERVER_USERNAME,
      serverPassword,
      githubToken,
      isOnboardingComplete: onboardingDone === 'true',
      ...(cloneDir ? { cloneDirectory: cloneDir } : {}),
    });
  },
}));
