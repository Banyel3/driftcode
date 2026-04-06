import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_KEYS, DEFAULT_SERVER_USERNAME } from '../constants';
import type { Project } from '@driftcode/opencode-client';
import type { GitHubRepo } from '@driftcode/github-client';

export type ActiveProject =
  | { kind: 'server'; project: Project }
  | {
    kind: 'github';
    repo: GitHubRepo;
    selectedBranch?: string;
    resolvedWorktree?: string | null;
  };

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

  /** Currently selected app-wide project context (server or GitHub repo). */
  activeProject: ActiveProject | null;

  /** User-configured directory for git clone operations */
  cloneDirectory: string;

  /** Persist active project between app launches when enabled. */
  keepActiveProject: boolean;

  /**
   * When true the Connect screen pre-fills URL + password with the last-used
   * values and credentials are persisted to SecureStore on connect.
   * When false the form starts blank and no credentials are written to disk.
   * Defaults to true for convenience.
   */
  rememberCredentials: boolean;

  // ── Actions ───────────────────────────────────────────────────────────────
  setServerUrl: (url: string) => void;
  setServerUsername: (username: string) => void;
  setServerPassword: (password: string) => void;
  setGithubToken: (token: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  setActiveProject: (project: ActiveProject | null) => void;
  setGitHubProjectBranch: (branch: string) => void;
  setGitHubProjectWorktree: (worktree: string | null) => void;
  clearActiveProject: () => void;
  setCloneDirectory: (dir: string) => void;
  setKeepActiveProject: (keep: boolean) => void;

  /** Marks onboarding as done and persists the flag to SecureStore */
  setOnboardingComplete: () => void;

  /**
   * Toggle the remember-credentials preference.
   * Turning it OFF immediately wipes the stored URL + password from SecureStore
   * so they won't re-appear next time the Connect screen opens.
   * Turning it ON (re-)persists the current in-memory credentials.
   */
  setRememberCredentials: (remember: boolean) => void;

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
export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  serverUrl: null,
  serverUsername: DEFAULT_SERVER_USERNAME,
  serverPassword: null,
  githubToken: null,
  isConnected: false,
  isOnboardingComplete: false,
  activeSessionId: null,
  activeProject: null,
  cloneDirectory: '~/projects/',
  keepActiveProject: false,
  rememberCredentials: true,

  setServerUrl: (url) => {
    set({ serverUrl: url });
    if (get().rememberCredentials) {
      void SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_URL, url);
    }
  },

  setServerUsername: (username) => {
    set({ serverUsername: username });
    // Username is not secret — always persist so the field is pre-filled.
    void SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_USERNAME, username);
  },

  setServerPassword: (password) => {
    set({ serverPassword: password });
    if (get().rememberCredentials) {
      void SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_PASSWORD, password);
    }
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

  setActiveProject: (project) => {
    set({ activeProject: project });
    if (get().keepActiveProject && project) {
      void SecureStore.setItemAsync(
        SECURE_STORE_KEYS.ACTIVE_PROJECT,
        JSON.stringify(project),
      );
    } else {
      void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACTIVE_PROJECT);
    }
  },

  setGitHubProjectBranch: (branch) => {
    const current = get().activeProject;
    if (!current || current.kind !== 'github') return;
    if ((current.selectedBranch ?? current.repo.defaultBranch) === branch) return;
    const next: ActiveProject = {
      ...current,
      selectedBranch: branch,
    };
    set({ activeProject: next });
    if (get().keepActiveProject) {
      void SecureStore.setItemAsync(
        SECURE_STORE_KEYS.ACTIVE_PROJECT,
        JSON.stringify(next),
      );
    }
  },

  setGitHubProjectWorktree: (worktree) => {
    const current = get().activeProject;
    if (!current || current.kind !== 'github') return;
    if ((current.resolvedWorktree ?? null) === worktree) return;
    const next: ActiveProject = {
      ...current,
      resolvedWorktree: worktree,
    };
    set({ activeProject: next });
    if (get().keepActiveProject) {
      void SecureStore.setItemAsync(
        SECURE_STORE_KEYS.ACTIVE_PROJECT,
        JSON.stringify(next),
      );
    }
  },

  clearActiveProject: () => {
    set({ activeProject: null });
    void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACTIVE_PROJECT);
  },

  setCloneDirectory: (dir) => {
    set({ cloneDirectory: dir });
    void SecureStore.setItemAsync(SECURE_STORE_KEYS.CLONE_DIRECTORY, dir);
  },

  setKeepActiveProject: (keep) => {
    set({ keepActiveProject: keep });
    void SecureStore.setItemAsync(
      SECURE_STORE_KEYS.KEEP_ACTIVE_PROJECT,
      keep ? 'true' : 'false',
    );

    if (!keep) {
      void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACTIVE_PROJECT);
    } else {
      const activeProject = get().activeProject;
      if (activeProject) {
        void SecureStore.setItemAsync(
          SECURE_STORE_KEYS.ACTIVE_PROJECT,
          JSON.stringify(activeProject),
        );
      }
    }
  },

  setOnboardingComplete: () => {
    set({ isOnboardingComplete: true });
    void SecureStore.setItemAsync(SECURE_STORE_KEYS.ONBOARDING_COMPLETE, 'true');
  },

  setRememberCredentials: (remember) => {
    set({ rememberCredentials: remember });
    void SecureStore.setItemAsync(
      SECURE_STORE_KEYS.REMEMBER_CREDENTIALS,
      remember ? 'true' : 'false',
    );
    if (!remember) {
      // Wipe URL + password from disk so they don't pre-fill next time.
      void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.SERVER_URL);
      void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.SERVER_PASSWORD);
    } else {
      // Re-persist current in-memory credentials.
      const { serverUrl, serverPassword } = get();
      if (serverUrl) {
        void SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_URL, serverUrl);
      }
      if (serverPassword) {
        void SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_PASSWORD, serverPassword);
      }
    }
  },

  clearConnection: () => {
    set({
      serverUrl: null,
      serverUsername: DEFAULT_SERVER_USERNAME,
      serverPassword: null,
      githubToken: null,
      isConnected: false,
      activeSessionId: null,
      activeProject: null,
      keepActiveProject: false,
    });
    void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.SERVER_URL);
    void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.SERVER_PASSWORD);
    void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.GITHUB_TOKEN);
    void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACTIVE_PROJECT);
    void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.KEEP_ACTIVE_PROJECT);
  },

  hydrate: async () => {
    const [
      serverUrl,
      serverUsername,
      serverPassword,
      githubToken,
      cloneDir,
      onboardingDone,
      rememberRaw,
      activeProjectRaw,
      keepActiveProjectRaw,
    ] = await Promise.all([
      SecureStore.getItemAsync(SECURE_STORE_KEYS.SERVER_URL),
      SecureStore.getItemAsync(SECURE_STORE_KEYS.SERVER_USERNAME),
      SecureStore.getItemAsync(SECURE_STORE_KEYS.SERVER_PASSWORD),
      SecureStore.getItemAsync(SECURE_STORE_KEYS.GITHUB_TOKEN),
      SecureStore.getItemAsync(SECURE_STORE_KEYS.CLONE_DIRECTORY),
      SecureStore.getItemAsync(SECURE_STORE_KEYS.ONBOARDING_COMPLETE),
      SecureStore.getItemAsync(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS),
      SecureStore.getItemAsync(SECURE_STORE_KEYS.ACTIVE_PROJECT),
      SecureStore.getItemAsync(SECURE_STORE_KEYS.KEEP_ACTIVE_PROJECT),
    ]);

    // rememberRaw is null on first launch (key not yet written) — default true.
    const rememberCredentials = rememberRaw === null ? true : rememberRaw === 'true';
    const keepActiveProject = keepActiveProjectRaw === 'true';

    if (!keepActiveProject && activeProjectRaw) {
      void SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACTIVE_PROJECT);
    }

    let activeProject: ActiveProject | null = null;
    if (keepActiveProject && activeProjectRaw) {
      try {
        const parsed = JSON.parse(activeProjectRaw) as unknown;
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'kind' in parsed &&
          ((parsed as { kind: string }).kind === 'server' ||
            (parsed as { kind: string }).kind === 'github')
        ) {
          activeProject = parsed as ActiveProject;
        }
      } catch {
        activeProject = null;
      }
    }

    set({
      serverUrl,
      serverUsername: serverUsername ?? DEFAULT_SERVER_USERNAME,
      serverPassword,
      githubToken,
      isOnboardingComplete: onboardingDone === 'true',
      rememberCredentials,
      keepActiveProject,
      activeProject,
      ...(cloneDir ? { cloneDirectory: cloneDir } : {}),
    });
  },
}));
