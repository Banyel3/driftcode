/**
 * SessionsScreen — Phase 4
 *
 * Displays all sessions for the connected opencode server:
 *   - FlatList sorted by most recently updated
 *   - Pull-to-refresh
 *   - Tap a session → navigate to the Chat tab with that session active
 *   - Trash icon on each card → Alert confirmation → DELETE /session/:id
 *   - FAB → create a new session and navigate to Chat
 *   - SSE stream keeps the list live without polling
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import { createOpenCodeClient, createSession } from '@driftcode/opencode-client';
import type { Session } from '@driftcode/opencode-client';

import {
  COLORS,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
} from '../../constants';
import { useConnectionStore } from '../../store';
import { useSessions } from '../../hooks/useSessions';
import { messageKeys } from '../../hooks/useMessages';
import { SessionCard } from './SessionCard';
import {
  getActiveProjectWorktree,
  sessionMatchesActiveProject,
} from '../../utils/projectContext';
import type { SessionListScreenProps } from '../../navigation/types';

export function SessionsScreen({ navigation }: SessionListScreenProps) {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);
  const activeSessionId = useConnectionStore((s) => s.activeSessionId);
  const activeProject = useConnectionStore((s) => s.activeProject);
  const setActiveSessionId = useConnectionStore((s) => s.setActiveSessionId);
  const [scopeMode, setScopeMode] = useState<'project' | 'all'>('project');

  const queryClient = useQueryClient();

  const {
    sessions,
    isLoading,
    isError,
    error,
    refresh,
    isRefreshing,
    remove,
  } = useSessions();

  const activeWorktree = getActiveProjectWorktree(activeProject);

  const visibleSessions = useMemo(() => {
    if (scopeMode === 'all') return sessions;
    if (!activeProject) return [];
    return sessions.filter((session) => sessionMatchesActiveProject(session, activeProject));
  }, [scopeMode, activeProject, sessions]);

  // ── Open a session in the Chat tab ─────────────────────────────────────────
  const handleOpen = useCallback(
    (session: Session) => {
      setActiveSessionId(session.id);
      navigation.navigate('Conversation', { sessionId: session.id });
    },
    [navigation, setActiveSessionId],
  );

  // ── Create a new session ──────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!serverUrl || !serverPassword) return;
    try {
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      const newSession = await createSession(
        client,
        activeWorktree && scopeMode === 'project' ? { path: activeWorktree } : {},
      );
      setActiveSessionId(newSession.id);
      // Clear any stale messages for the new session.
      queryClient.removeQueries({
        queryKey: messageKeys.session(newSession.id),
      });
      navigation.navigate('Conversation', { sessionId: newSession.id });
    } catch (err) {
      Alert.alert(
        'Could not create session',
        err instanceof Error ? err.message : String(err),
      );
    }
  }, [
    serverUrl,
    serverPassword,
    serverUsername,
    setActiveSessionId,
    navigation,
    queryClient,
    activeWorktree,
    scopeMode,
  ]);

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: Session }) => (
      <SessionCard
        session={item}
        isActive={item.id === activeSessionId}
        onPress={handleOpen}
        onDelete={remove}
      />
    ),
    [activeSessionId, handleOpen, remove],
  );

  const keyExtractor = useCallback((item: Session) => item.id, []);

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header
          onCreate={handleCreate}
          scopeMode={scopeMode}
          onChangeScope={setScopeMode}
          hasProjectScope={activeProject !== null}
        />
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>
            {error?.message ?? 'Failed to load sessions.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        onCreate={handleCreate}
        scopeMode={scopeMode}
        onChangeScope={setScopeMode}
        hasProjectScope={activeProject !== null}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleSessions}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={visibleSessions.length === 0 ? styles.emptyContainer : undefined}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="layers-outline"
                size={56}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyTitle}>No sessions yet</Text>
              <Text style={styles.emptyBody}>
                {activeProject !== null && scopeMode === 'project'
                  ? 'No sessions in this project yet. Tap + to start one.'
                  : scopeMode === 'project'
                    ? 'Select a project from the Projects tab to scope sessions.'
                    : 'Tap the + button to start a new AI coding session.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreate}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({
  onCreate,
  scopeMode,
  onChangeScope,
  hasProjectScope,
}: {
  onCreate: () => void;
  scopeMode: 'project' | 'all';
  onChangeScope: (mode: 'project' | 'all') => void;
  hasProjectScope: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Sessions</Text>
        {hasProjectScope && (
          <View style={styles.scopeSwitch}>
            <TouchableOpacity
              style={[styles.scopeBtn, scopeMode === 'project' && styles.scopeBtnActive]}
              onPress={() => onChangeScope('project')}
            >
              <Text style={[styles.scopeText, scopeMode === 'project' && styles.scopeTextActive]}>This Project</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scopeBtn, scopeMode === 'all' && styles.scopeBtnActive]}
              onPress={() => onChangeScope('all')}
            >
              <Text style={[styles.scopeText, scopeMode === 'all' && styles.scopeTextActive]}>All</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.headerBtn} onPress={onCreate}>
        <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
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
  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  scopeSwitch: {
    flexDirection: 'row',
    gap: 6,
  },
  scopeBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  scopeBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}20`,
  },
  scopeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  scopeTextActive: {
    color: COLORS.primary,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── States ────────────────────────────────────────────────────────────────
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
  emptyContainer: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
    paddingTop: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyBody: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyHighlight: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  // ── FAB ───────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
