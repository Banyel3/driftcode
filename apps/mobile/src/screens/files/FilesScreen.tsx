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
import React, { useState, useCallback, useEffect } from 'react';
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
  getSession,
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
import { FileTreeNode } from './FileTreeNode';
import { FileViewer } from './FileViewer';
import type { FilesScreenProps } from '../../navigation/types';

export function FilesScreen({ route, navigation }: FilesScreenProps) {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);
  const activeSessionId = useConnectionStore((s) => s.activeSessionId);
  const setActiveSessionId = useConnectionStore((s) => s.setActiveSessionId);
  const queryClient = useQueryClient();

  // ── Root path — use active session's dir if available ────────────────────
  // Starts as null; only set to a real path once we have one.
  // We NEVER default to '/' to avoid browsing the server filesystem root.
  const [rootPath, setRootPath] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSessionId || !serverUrl || !serverPassword) return;
    const client = createOpenCodeClient({
      serverUrl,
      username: serverUsername,
      password: serverPassword,
    });
    getSession(client, activeSessionId)
      .then((session) => {
        if (session.path && typeof session.path === 'string') {
          setRootPath(session.path);
        }
      })
      .catch(() => {/* ignore — keep rootPath as null */});
  }, [activeSessionId, serverUrl, serverPassword, serverUsername]);

  // ── File selection ────────────────────────────────────────────────────────
  const routeFilePath = route.params?.filePath ?? null;
  const [selectedFile, setSelectedFile] = useState<string | null>(routeFilePath);

  // If the route param changes (e.g. deep-link), open that file.
  useEffect(() => {
    if (routeFilePath) setSelectedFile(routeFilePath);
  }, [routeFilePath]);

  // ── Root file tree ────────────────────────────────────────────────────────
  const { entries, isLoading, isError, error, refresh } = useFileTree(
    rootPath ?? '',
    rootPath !== null,
  );

  // ── Ask AI handler ────────────────────────────────────────────────────────
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const handleAskAI = useCallback(
    async (message: string, _filePath: string) => {
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
        navigation.navigate('Chat', { sessionId, initialMessage: message });
      } catch (err) {
        Alert.alert(
          'Could not open session',
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setIsCreatingSession(false);
      }
    },
    [serverUrl, serverPassword, serverUsername, activeSessionId, rootPath, setActiveSessionId, queryClient, navigation],
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
        {rootPath !== null && (
          <TouchableOpacity
            onPress={refresh}
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
          <Text style={styles.emptyTitle}>No project open</Text>
          <Text style={styles.emptyBody}>
            Open a project from the Projects tab or start a session from the Sessions tab to browse files here.
          </Text>
        </View>
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
          <Text style={styles.emptyTitle}>Empty directory</Text>
          <Text style={styles.emptyBody}>{rootPath}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.tree}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refresh}
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
              onSelectFile={setSelectedFile}
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
  // ── Tree ───────────────────────────────────────────────────────────────
  tree: {
    flex: 1,
  },
  treePad: {
    height: SPACING.xl,
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
