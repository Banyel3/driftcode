/**
 * FilesScreen — Phase 6
 *
 * Two sub-views managed by local state:
 *
 *  Tree view  (selectedFile === null)
 *    - Collapsible file tree rooted at the active session's working directory.
 *    - If no session is active and no project is known, shows a CTA to open
 *      a project first (never defaults to the server root '/').
 *    - Pull-to-refresh reloads the root directory listing.
 *    - Tapping a file → switches to File view.
 *    - Tapping a directory → expands / collapses in-place (handled by
 *      FileTreeNode itself).
 *    - The Files tab can receive a `filePath` route param to jump directly
 *      to the File view.
 *
 *  File view  (selectedFile !== null)
 *    - Shows syntax-highlighted content via FileViewer.
 *    - "Ask AI" / quick action buttons create a session and open Chat.
 *    - Back button returns to the tree view.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import {
  createOpenCodeClient,
  createSession,
} from '@driftcode/opencode-client';

import {
  COLORS,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
} from '../../constants';
import { useConnectionStore } from '../../store';
import { useFileTree } from '../../hooks/useFileTree';
import { messageKeys } from '../../hooks/useMessages';
import { useServerProjects } from '../../hooks/useServerProjects';
import { useSessions } from '../../hooks/useSessions';
import { useMessages } from '../../hooks/useMessages';
import { useSessionDiff } from '../../hooks/useSessionDiff';
import { useInstancePath } from '../../hooks/useInstancePath';
import { FileTreeNode } from './FileTreeNode';
import { FileViewer } from './FileViewer';
import {
  getActiveProjectWorktree,
  getProjectWorktree,
  sessionMatchesActiveProject,
  projectMatchesActiveProject,
  normalizePath,
} from '../../utils/projectContext';
import type { FilesScreenProps } from '../../navigation/types';

export function FilesScreen({ route, navigation }: FilesScreenProps) {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);
  const activeSessionId = useConnectionStore((s) => s.activeSessionId);
  const activeProject = useConnectionStore((s) => s.activeProject);
  const setActiveSessionId = useConnectionStore((s) => s.setActiveSessionId);
  const setActiveFileContext = useConnectionStore((s) => s.setActiveFileContext);
  const setGitHubProjectWorktree = useConnectionStore((s) => s.setGitHubProjectWorktree);
  const queryClient = useQueryClient();
  const { projects: serverProjects } = useServerProjects();
  const { sessions } = useSessions();
  const { pathInfo, refresh: refreshInstancePath } = useInstancePath();

  const [viewMode, setViewMode] = useState<'tree' | 'changed'>('tree');

  const rootPath = useMemo(() => {
    const direct = getActiveProjectWorktree(activeProject);
    if (direct) return direct;
    if (!activeProject || activeProject.kind !== 'github') return null;
    const matched = serverProjects.find((project) => projectMatchesActiveProject(project, activeProject));
    return matched ? getProjectWorktree(matched) : null;
  }, [activeProject, serverProjects]);

  useEffect(() => {
    if (activeProject?.kind !== 'github') return;
    setGitHubProjectWorktree(rootPath);
  }, [activeProject, rootPath, setGitHubProjectWorktree]);

  const instanceWorktree = normalizePath(pathInfo?.worktree ?? null);

  const fileQueryPath = useMemo(() => {
    if (!rootPath) return null;
    if (!instanceWorktree) return rootPath;
    if (rootPath === instanceWorktree) return '';
    if (rootPath.startsWith(`${instanceWorktree}/`)) {
      return rootPath.slice(instanceWorktree.length + 1);
    }
    return null;
  }, [rootPath, instanceWorktree]);

  const isProjectInCurrentInstance = rootPath !== null && fileQueryPath !== null;

  // ── File selection ────────────────────────────────────────────────────────
  const routeFilePath = route.params?.filePath ?? null;
  const [selectedFile, setSelectedFile] = useState<string | null>(routeFilePath);

  const resolveFilePath = useCallback(
    (filePath: string) => {
      if (!filePath) return filePath;
      if (filePath.startsWith('/')) return filePath;
      const base = instanceWorktree ?? rootPath;
      if (!base) return filePath;
      return `${base.replace(/\/+$/, '')}/${filePath.replace(/^\/+/, '')}`;
    },
    [rootPath, instanceWorktree],
  );

  // If the route param changes (e.g. deep-link), open that file.
  useEffect(() => {
    if (routeFilePath) setSelectedFile(routeFilePath);
  }, [routeFilePath]);

  useEffect(() => {
    setSelectedFile(null);
  }, [rootPath]);

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['fileTree'] });
  }, [rootPath, queryClient]);

  // ── Root file tree ────────────────────────────────────────────────────────
  const { entries, isLoading, isError, error, refresh } = useFileTree(
    fileQueryPath ?? '',
    rootPath !== null && fileQueryPath !== null,
  );

  const handleRefreshTree = useCallback(async () => {
    await refreshInstancePath();
    await refresh();
  }, [refreshInstancePath, refresh]);

  // ── Ask AI handler ────────────────────────────────────────────────────────
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const scopedSessions = useMemo(() => {
    if (!activeProject) return sessions;
    return sessions.filter((session) => sessionMatchesActiveProject(session, activeProject));
  }, [sessions, activeProject]);

  const diffSession = useMemo(() => {
    const active = scopedSessions.find((session) => session.id === activeSessionId);
    return active ?? scopedSessions[0] ?? null;
  }, [scopedSessions, activeSessionId]);

  const { messages } = useMessages(diffSession?.id ?? null);

  const latestUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i].id;
    }
    return null;
  }, [messages]);

  const {
    diffs,
    isLoading: isLoadingDiffs,
    isError: isDiffError,
    error: diffError,
    refresh: refreshDiff,
  } = useSessionDiff(diffSession?.id ?? null, latestUserMessageId);

  const handleAskAI = useCallback(
    async (message: string, context: { filePath: string; snippet?: string }) => {
      if (!serverUrl || !serverPassword) return;
      setIsCreatingSession(true);
      try {
        const client = createOpenCodeClient({
          serverUrl,
          username: serverUsername,
          password: serverPassword,
        });
        // Reuse active session if one exists, otherwise create a new one.
        let sessionId = activeSessionId;
        if (!sessionId) {
          const session = await createSession(client, rootPath ? { path: rootPath } : {});
          sessionId = session.id;
          setActiveSessionId(sessionId);
          queryClient.removeQueries({ queryKey: messageKeys.session(sessionId) });
        }

        setActiveFileContext({
          filePath: context.filePath,
          snippet: context.snippet,
          sessionId,
        });

        navigation.navigate('Chat', {
          screen: 'Conversation',
          params: { sessionId, initialMessage: message },
        });
      } catch (err) {
        Alert.alert(
          'Could not open session',
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setIsCreatingSession(false);
      }
    },
    [
      serverUrl,
      serverPassword,
      serverUsername,
      activeSessionId,
      rootPath,
      setActiveSessionId,
      setActiveFileContext,
      queryClient,
      navigation,
    ],
  );

  // ── File view ─────────────────────────────────────────────────────────────
  if (selectedFile !== null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {isCreatingSession && (
          <View style={styles.creatingOverlay}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.creatingText}>Opening session…</Text>
          </View>
        )}
        <FileViewer
          filePath={selectedFile}
          onAskAI={handleAskAI}
          onClose={() => setSelectedFile(null)}
        />
      </SafeAreaView>
    );
  }

  // ── Tree view ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — only show path when we have one */}
      <View style={styles.header}>
        <Ionicons name="folder-open-outline" size={16} color={COLORS.warning} />
        <Text style={styles.rootPath} numberOfLines={1}>
          {rootPath ?? 'No project open'}
        </Text>
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'tree' && styles.modeBtnActive]}
            onPress={() => setViewMode('tree')}
          >
            <Text style={[styles.modeBtnText, viewMode === 'tree' && styles.modeBtnTextActive]}>Tree</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'changed' && styles.modeBtnActive]}
            onPress={() => setViewMode('changed')}
          >
            <Text style={[styles.modeBtnText, viewMode === 'changed' && styles.modeBtnTextActive]}>Changed</Text>
          </TouchableOpacity>
        </View>
        {rootPath !== null && (
          <TouchableOpacity
            onPress={handleRefreshTree}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.refreshBtn}
          >
            <Ionicons name="refresh-outline" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* No-project CTA state */}
      {rootPath === null ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>
            {activeProject?.kind === 'github' ? 'Repository not opened on server' : 'No project open'}
          </Text>
          <Text style={styles.emptyBody}>
            {activeProject?.kind === 'github'
              ? 'Open a session from the project detail screen to clone and open this repository on your server, then files will appear here.'
              : 'Select a project from the Projects tab to browse files here.'}
          </Text>
        </View>
      ) : !isProjectInCurrentInstance ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.warning} />
          <Text style={styles.emptyTitle}>Project not active in server instance</Text>
          <Text style={styles.emptyBody}>
            Open this project in a chat session first, then file tree browsing will use the active server worktree.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefreshTree}>
            <Text style={styles.retryText}>Refresh context</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'changed' ? (
        isLoadingDiffs ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : isDiffError ? (
          <View style={styles.center}>
            <Ionicons name="warning-outline" size={40} color={COLORS.error} />
            <Text style={styles.errorText}>{diffError?.message ?? 'Could not load changed files.'}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={refreshDiff}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : diffs.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="git-compare-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No changed files</Text>
            <Text style={styles.emptyBody}>Run a change in this project and it will appear here.</Text>
          </View>
        ) : (
          <ScrollView style={styles.tree} showsVerticalScrollIndicator={false}>
            {diffs.map((diff) => (
              <TouchableOpacity
                key={diff.file}
                style={styles.diffRow}
                onPress={() => setSelectedFile(resolveFilePath(diff.file))}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text-outline" size={16} color={COLORS.textSecondary} />
                <View style={styles.diffBody}>
                  <Text style={styles.diffPath} numberOfLines={1}>{diff.file}</Text>
                  <Text style={styles.diffMeta}>+{diff.additions}  -{diff.deletions}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <View style={styles.treePad} />
          </ScrollView>
        )
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={40} color={COLORS.error} />
          <Text style={styles.errorText}>
            {error?.message ?? 'Could not load file tree.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="folder-open-outline"
            size={48}
            color={COLORS.textMuted}
          />
          <Text style={styles.emptyTitle}>Empty Directory</Text>
          <Text style={styles.emptyBody}>{rootPath}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.tree}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={handleRefreshTree}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {entries.map((entry) => (
            <FileTreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              selectedPath={selectedFile}
              onSelectFile={(filePath) => setSelectedFile(resolveFilePath(filePath))}
            />
          ))}
          {/* Bottom padding so last item isn't cut off */}
          <View style={styles.treePad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rootPath: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontFamily: 'Courier',
  },
  refreshBtn: {
    flexShrink: 0,
    padding: 4,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: 4,
    marginRight: SPACING.xs,
  },
  modeBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  modeBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}20`,
  },
  modeBtnText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: COLORS.primary,
  },
  // ── Tree ───────────────────────────────────────────────────────────────
  tree: {
    flex: 1,
  },
  treePad: {
    height: SPACING.xl,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  diffBody: {
    flex: 1,
    gap: 2,
  },
  diffPath: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  diffMeta: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontFamily: 'Courier',
  },
  // ── States ─────────────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyBody: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontFamily: 'Courier',
    textAlign: 'center',
  },
  // ── Creating session overlay ──────────────────────────────────────────
  creatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  creatingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
});
