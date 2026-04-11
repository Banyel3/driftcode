import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { createOpenCodeClient, createSession } from '@driftcode/opencode-client';
import {
  COLORS,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
  MIN_TOUCH_TARGET,
} from '../../constants';
import { useConnectionStore } from '../../store';
import { messageKeys } from '../../hooks/useMessages';
import { useBranches } from '../../hooks/useBranches';
import { usePullRequests } from '../../hooks/usePullRequests';
import { useServerProjects } from '../../hooks/useServerProjects';
import { useProjectBranchSwitch } from '../../hooks/useProjectBranchSwitch';
import { basenameSafe } from '../../utils/path';
import { getProjectWorktree } from '../../utils/projectContext';
import type { ProjectDetailScreenProps } from '../../navigation/types';

export function ProjectDetailScreen({ navigation }: ProjectDetailScreenProps) {
  const activeProject = useConnectionStore((s) => s.activeProject);
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);
  const setActiveSessionId = useConnectionStore((s) => s.setActiveSessionId);
  const setGitHubProjectBranch = useConnectionStore((s) => s.setGitHubProjectBranch);
  const setGitHubProjectWorktree = useConnectionStore((s) => s.setGitHubProjectWorktree);
  const queryClient = useQueryClient();
  const [isOpening, setIsOpening] = useState(false);
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const { projects } = useServerProjects();
  const { switchBranch, isSwitching } = useProjectBranchSwitch();

  const isGitHub = activeProject?.kind === 'github';
  const owner = isGitHub ? activeProject.repo.owner.login : null;
  const repoName = isGitHub ? activeProject.repo.name : null;

  const {
    branches,
    isLoading: isLoadingBranches,
    isError: isBranchError,
  } = useBranches(owner, repoName);
  const {
    pullRequests,
    isLoading: isLoadingPullRequests,
    isError: isPullRequestError,
  } = usePullRequests(owner, repoName);

  const selectedBranch =
    activeProject?.kind === 'github'
      ? activeProject.selectedBranch ?? activeProject.repo.defaultBranch
      : null;

  const activeWorktree = useMemo(() => {
    if (!activeProject) return null;
    if (activeProject.kind === 'server') {
      return getProjectWorktree(activeProject.project) ?? null;
    }
    return activeProject.resolvedWorktree ?? null;
  }, [activeProject]);

  const projectTitle = useMemo(() => {
    if (!activeProject) return 'Project';
    if (activeProject.kind === 'server') {
      return activeProject.project.name?.trim() || getProjectWorktree(activeProject.project) || 'Project';
    }
    return activeProject.repo.fullName;
  }, [activeProject]);

  const projectMeta = useMemo(() => {
    if (!activeProject) return null;
    if (activeProject.kind === 'server') {
      return getProjectWorktree(activeProject.project);
    }
    return activeProject.repo.cloneUrl;
  }, [activeProject]);

  const handleOpenSession = useCallback(async () => {
    if (!activeProject || !serverUrl || !serverPassword) return;
    setIsOpening(true);
    try {
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });

      const session =
        activeProject.kind === 'server'
          ? await createSession(client, {
            path: getProjectWorktree(activeProject.project) ?? undefined,
          })
          : await createSession(client, {});

      setActiveSessionId(session.id);
      queryClient.removeQueries({ queryKey: messageKeys.session(session.id) });

      const initialMessage =
        activeProject.kind === 'github'
          ? `Please clone ${activeProject.repo.cloneUrl} into ~/projects/${activeProject.repo.name} using branch ${selectedBranch ?? activeProject.repo.defaultBranch} and then open that directory as the working project.`
          : undefined;

      navigation.navigate('Chat', {
        screen: 'Conversation',
        params: { sessionId: session.id, ...(initialMessage ? { initialMessage } : {}) },
      });
    } catch (err) {
      Alert.alert('Could not open session', err instanceof Error ? err.message : String(err));
    } finally {
      setIsOpening(false);
    }
  }, [
    activeProject,
    selectedBranch,
    serverUrl,
    serverPassword,
    serverUsername,
    setActiveSessionId,
    queryClient,
    navigation,
  ]);

  const handleSelectBranch = useCallback(
    (branch: string) => {
      setGitHubProjectBranch(branch);
    },
    [setGitHubProjectBranch],
  );

  const handleSwitchActiveBranch = useCallback(
    async (branch: string) => {
      if (!activeWorktree) {
        Alert.alert('Branch switch unavailable', 'Could not determine the active project worktree.');
        return;
      }

      try {
        await switchBranch({ worktreePath: activeWorktree, branch });
        if (activeProject?.kind === 'github') {
          setGitHubProjectBranch(branch);
        }
        setBranchModalVisible(false);
        setBranchSearch('');
        Alert.alert('Branch switched', `Now on ${branch}.`);
      } catch (err) {
        Alert.alert('Failed to switch branch', err instanceof Error ? err.message : String(err));
      }
    },
    [activeWorktree, switchBranch, activeProject?.kind, setGitHubProjectBranch],
  );

  useEffect(() => {
    if (!activeProject || activeProject.kind !== 'github') return;
    const repoName = activeProject.repo.name.toLowerCase();
    const match = projects.find((project) => {
      const worktree = getProjectWorktree(project);
      const base = worktree ? basenameSafe(worktree)?.toLowerCase() : null;
      return base === repoName;
    });
    setGitHubProjectWorktree(match ? getProjectWorktree(match) : null);
  }, [activeProject, projects, setGitHubProjectWorktree]);

  const handleBrowseFiles = useCallback(() => {
    navigation.navigate('Files');
  }, [navigation]);

  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return branches;
    const q = branchSearch.trim().toLowerCase();
    return branches.filter((branch) => branch.name.toLowerCase().includes(q));
  }, [branches, branchSearch]);

  if (!activeProject) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No active project</Text>
          <Text style={styles.emptyBody}>Select a project from the list first.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Back to projects</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Project</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.projectTitle} numberOfLines={2}>{projectTitle}</Text>
          {projectMeta ? (
            <Text style={styles.projectMeta} numberOfLines={2}>{projectMeta}</Text>
          ) : null}
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {activeProject.kind === 'github' ? 'GitHub Repo' : 'Server Project'}
              </Text>
            </View>
            {activeProject.kind === 'github' && selectedBranch ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{selectedBranch}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {activeProject.kind === 'github' ? (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Branches</Text>
                <TouchableOpacity
                  style={styles.switchBranchBtn}
                  onPress={() => setBranchModalVisible(true)}
                  disabled={isLoadingBranches || branches.length === 0}
                >
                  <Text style={styles.switchBranchBtnText}>Switch</Text>
                </TouchableOpacity>
              </View>
              {isLoadingBranches ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : isBranchError ? (
                <Text style={styles.sectionError}>Could not load branches.</Text>
              ) : branches.length === 0 ? (
                <Text style={styles.sectionEmpty}>No branches found.</Text>
              ) : (
                branches.slice(0, 10).map((branch) => (
                  <TouchableOpacity
                    key={branch.name}
                    style={styles.rowItem}
                    onPress={() => handleSelectBranch(branch.name)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="git-branch-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.rowItemText} numberOfLines={1}>{branch.name}</Text>
                    {selectedBranch === branch.name ? (
                      <Ionicons name="checkmark" size={14} color={COLORS.primary} />
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Open Pull Requests</Text>
              {isLoadingPullRequests ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : isPullRequestError ? (
                <Text style={styles.sectionError}>Could not load pull requests.</Text>
              ) : pullRequests.length === 0 ? (
                <Text style={styles.sectionEmpty}>No open pull requests.</Text>
              ) : (
                pullRequests.slice(0, 8).map((pr) => (
                  <View key={pr.id} style={styles.prItem}>
                    <Text style={styles.prTitle} numberOfLines={2}>#{pr.number} {pr.title}</Text>
                    <Text style={styles.prMeta} numberOfLines={1}>
                      {pr.headRefName} {'->'} {pr.baseRefName} by {pr.user.login}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.secondaryBtn]}
          onPress={handleBrowseFiles}
        >
          <Ionicons name="folder-open-outline" size={16} color={COLORS.text} />
          <Text style={styles.secondaryBtnText}>Browse Files</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.primaryBtn, isOpening && styles.primaryBtnDisabled]}
          onPress={handleOpenSession}
          disabled={isOpening}
        >
          {isOpening ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.white} />
          )}
          <Text style={styles.primaryBtnText}>Open Session</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={branchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch Branch</Text>
              <TouchableOpacity onPress={() => setBranchModalVisible(false)}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                value={branchSearch}
                onChangeText={setBranchSearch}
                placeholder="Filter branches…"
                placeholderTextColor={COLORS.textMuted}
                style={styles.branchSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <ScrollView style={styles.branchList} showsVerticalScrollIndicator={false}>
                {filteredBranches.map((branch) => (
                  <TouchableOpacity
                    key={`switch-${branch.name}`}
                    style={styles.branchSwitchRow}
                    onPress={() => {
                      void handleSwitchActiveBranch(branch.name);
                    }}
                    disabled={isSwitching}
                  >
                    <Ionicons name="git-branch-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.branchSwitchText} numberOfLines={1}>{branch.name}</Text>
                    {selectedBranch === branch.name ? (
                      <Ionicons name="checkmark" size={14} color={COLORS.primary} />
                    ) : null}
                  </TouchableOpacity>
                ))}
                {filteredBranches.length === 0 ? (
                  <Text style={styles.sectionEmpty}>No matching branches.</Text>
                ) : null}
              </ScrollView>

              {isSwitching ? (
                <View style={styles.switchingRow}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.switchingText}>Switching branch…</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBack: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  projectTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  projectMeta: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontFamily: 'Courier',
  },
  tagRow: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
  },
  tag: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  switchBranchBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  switchBranchBtnText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  sectionEmpty: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  sectionError: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 4,
  },
  rowItemText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  prItem: {
    gap: 2,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  prTitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontWeight: '600',
  },
  prMeta: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  actionBtn: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  backBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
  },
  backBtnText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalCard: {
    maxHeight: '80%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '700',
  },
  modalBody: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  branchSearchInput: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
  },
  branchList: {
    maxHeight: 300,
  },
  branchSwitchRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  branchSwitchText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  switchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  switchingText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
});
