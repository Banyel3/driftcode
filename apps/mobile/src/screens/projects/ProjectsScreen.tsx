/**
 * ProjectsScreen — Phase 5
 *
 * Two modes:
 *
 *  GitHub mode (githubToken set)
 *    - Search bar (in-memory filter <3 chars; GitHub API search ≥3 chars)
 *    - FlatList of GitHubRepo cards
 *    - "Open" → creates a new session, navigates to Chat with a pre-filled
 *      clone message so the agent clones and opens the repo.
 *
 *  Server mode (no GitHub token)
 *    - FlatList of server-side Project directories
 *    - "Open" → creates a session with the project's path as working dir
 *    - Upsell banner to connect GitHub
 *
 * In both modes the user lands in the Chat tab after tapping "Open".
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import {
  createOpenCodeClient,
  createSession,
} from '@driftcode/opencode-client';
import type { Project } from '@driftcode/opencode-client';
import type { GitHubRepo } from '@driftcode/github-client';

import {
  COLORS,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
  MIN_TOUCH_TARGET,
} from '../../constants';
import { useConnectionStore } from '../../store';
import { useServerProjects } from '../../hooks/useServerProjects';
import { useGitHubRepos } from '../../hooks/useGitHubRepos';
import { messageKeys } from '../../hooks/useMessages';
import { ProjectCard } from './ProjectCard';
import { RepoCard } from './RepoCard';
import type { ProjectsScreenProps } from '../../navigation/types';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export function ProjectsScreen({ navigation }: ProjectsScreenProps) {
  const githubToken = useConnectionStore((s) => s.githubToken);
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);
  const setActiveSessionId = useConnectionStore((s) => s.setActiveSessionId);
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const hasGitHub = githubToken !== null;

  // ── Data hooks ──────────────────────────────────────────────────────────
  const serverData = useServerProjects();
  const githubData = useGitHubRepos(searchQuery);

  const { repos, isLoading: ghLoading, isError: ghError, refresh: ghRefresh, isRefreshing: ghRefreshing } = githubData;
  const { projects, isLoading: svLoading, isError: svError, refresh: svRefresh, isRefreshing: svRefreshing } = serverData;

  // ── Open helpers ─────────────────────────────────────────────────────────

  /** Create a session (optionally with a path) and navigate to Chat. */
  const openSession = useCallback(
    async (opts: { path?: string; cloneMessage?: string }) => {
      if (!serverUrl || !serverPassword) return;
      setIsOpening(true);
      try {
        const client = createOpenCodeClient({
          serverUrl,
          username: serverUsername,
          password: serverPassword,
        });
        const session = await createSession(client, opts.path ? { path: opts.path } : {});
        setActiveSessionId(session.id);
        queryClient.removeQueries({ queryKey: messageKeys.session(session.id) });

        // Navigate to Chat; if a clone message was provided it will be sent
        // automatically via the route param.
        if (opts.cloneMessage) {
          navigation.navigate('Chat', {
            sessionId: session.id,
            initialMessage: opts.cloneMessage,
          });
        } else {
          navigation.navigate('Chat', { sessionId: session.id });
        }
      } catch (err) {
        Alert.alert(
          'Could not open session',
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setIsOpening(false);
      }
    },
    [serverUrl, serverPassword, serverUsername, setActiveSessionId, queryClient, navigation],
  );

  const handleOpenProject = useCallback(
    (project: Project) => {
      void openSession({ path: project.path });
    },
    [openSession],
  );

  const handleOpenRepo = useCallback(
    (repo: GitHubRepo) => {
      // Build a natural-language clone + open instruction for the agent.
      const cloneDir = `~/projects/${repo.name}`;
      const message =
        `Please clone ${repo.cloneUrl} into ${cloneDir} ` +
        `(default branch: ${repo.defaultBranch}) and then open that directory as the working project.`;
      void openSession({ cloneMessage: message });
    },
    [openSession],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const renderRepo = useCallback(
    ({ item }: { item: GitHubRepo }) => (
      <RepoCard repo={item} onOpen={handleOpenRepo} />
    ),
    [handleOpenRepo],
  );

  const renderProject = useCallback(
    ({ item }: { item: Project }) => (
      <ProjectCard project={item} onOpen={handleOpenProject} />
    ),
    [handleOpenProject],
  );

  const repoKeyExtractor = useCallback((item: GitHubRepo) => String(item.id), []);
  const projectKeyExtractor = useCallback((item: Project) => item.id, []);

  // Loading overlay when creating session
  if (isOpening) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.openingText}>Creating session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── GitHub mode ──────────────────────────────────────────────────────────
  if (hasGitHub) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Projects</Text>
            <View style={styles.githubBadge}>
              <Ionicons name="logo-github" size={12} color={COLORS.success} />
              <Text style={styles.githubBadgeText}>GitHub</Text>
            </View>
          </View>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={16}
              color={COLORS.textMuted}
              style={styles.searchIcon}
            />
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search repositories…"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          {ghLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : ghError ? (
            <View style={styles.center}>
              <Ionicons name="warning-outline" size={40} color={COLORS.error} />
              <Text style={styles.errorText}>Failed to load GitHub repos.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={ghRefresh}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={repos}
              renderItem={renderRepo}
              keyExtractor={repoKeyExtractor}
              refreshControl={
                <RefreshControl
                  refreshing={ghRefreshing}
                  onRefresh={ghRefresh}
                  tintColor={COLORS.primary}
                  colors={[COLORS.primary]}
                />
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons
                    name="git-branch-outline"
                    size={48}
                    color={COLORS.textMuted}
                  />
                  <Text style={styles.emptyTitle}>
                    {searchQuery ? 'No repos found' : 'No repositories'}
                  </Text>
                  <Text style={styles.emptyBody}>
                    {searchQuery
                      ? `No results for "${searchQuery}"`
                      : 'Your GitHub repositories will appear here.'}
                  </Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Server mode (no GitHub token) ────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Projects</Text>
      </View>

      {/* GitHub upsell banner */}
      <TouchableOpacity
        style={styles.upsellBanner}
        onPress={() => navigation.navigate('Settings' as never)}
        activeOpacity={0.8}
      >
        <Ionicons name="logo-github" size={18} color={COLORS.white} />
        <View style={styles.upsellText}>
          <Text style={styles.upsellTitle}>Connect GitHub</Text>
          <Text style={styles.upsellBody}>
            Browse all your repos and open sessions in one tap.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
      </TouchableOpacity>

      {/* Server project list */}
      {svLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : svError ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={40} color={COLORS.error} />
          <Text style={styles.errorText}>Failed to load server projects.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={svRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={projects}
          renderItem={renderProject}
          keyExtractor={projectKeyExtractor}
          contentContainerStyle={projects.length === 0 ? styles.emptyFlex : undefined}
          refreshControl={
            <RefreshControl
              refreshing={svRefreshing}
              onRefresh={svRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="folder-open-outline"
                size={48}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyTitle}>No projects found</Text>
              <Text style={styles.emptyBody}>
                Open a coding session from the Sessions tab to register a
                project on the server.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
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
  flex: {
    flex: 1,
  },
  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  githubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.success + '66',
  },
  githubBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.success,
  },
  // ── Search ──────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.md,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    height: MIN_TOUCH_TARGET,
    gap: SPACING.xs,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    height: '100%',
  },
  // ── Upsell banner ───────────────────────────────────────────────────────
  upsellBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    margin: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
  },
  upsellText: {
    flex: 1,
  },
  upsellTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
  upsellBody: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.white + 'CC',
    marginTop: 2,
  },
  // ── States ──────────────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  openingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
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
  emptyFlex: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    gap: SPACING.md,
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
});
