/**
 * SettingsScreen — Phase 7
 *
 * Sections:
 *  SERVER      — URL (read-only), username, live connection dot, "Change Server"
 *  GITHUB      — OAuth connect/disconnect, shows avatar login when connected
 *  PREFERENCES — AI Model picker (modal), Clone Directory text input
 *  ABOUT       — App version, server version (from GET /global/health)
 *  ACCOUNT     — "Disconnect Server" danger action
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import { getHealth, createOpenCodeClient } from '@driftcode/opencode-client';
import type { ProviderModelOption } from '../../hooks/useProviders';
import { useProviders } from '../../hooks/useProviders';
import { useGitHubAuth } from '../../hooks/useGitHubAuth';
import { useConnectionStore } from '../../store';
import {
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  SPACING,
  BORDER_RADIUS,
} from '../../constants';
import type { SettingsScreenProps } from '../../navigation/types';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SectionLabelProps {
  title: string;
}
function SectionLabel({ title }: SectionLabelProps) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

interface RowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  danger?: boolean;
  rightElement?: React.ReactNode;
  disabled?: boolean;
}
function Row({
  icon,
  label,
  value,
  valueColor,
  onPress,
  danger,
  rightElement,
  disabled,
}: RowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      activeOpacity={onPress && !disabled ? 0.7 : 1}
      disabled={disabled || !onPress}
    >
      <View style={styles.rowLeft}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? COLORS.error : COLORS.textSecondary}
        />
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {rightElement ?? (
          <>
            {value ? (
              <Text
                style={[styles.rowValue, valueColor ? { color: valueColor } : null]}
                numberOfLines={1}
              >
                {value}
              </Text>
            ) : null}
            {onPress && !disabled ? (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={COLORS.textMuted}
              />
            ) : null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function Divider() {
  return (
    <View
      style={[
        styles.divider,
        { marginLeft: SPACING.md + 20 + SPACING.sm },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Model picker modal
// ---------------------------------------------------------------------------

interface ModelPickerProps {
  visible: boolean;
  options: ProviderModelOption[];
  selectedModelId: string | null;
  isLoading: boolean;
  onSelect: (option: ProviderModelOption) => void;
  onClose: () => void;
}

function ModelPickerModal({
  visible,
  options,
  selectedModelId,
  isLoading,
  onSelect,
  onClose,
}: ModelPickerProps) {
  // Group by provider for display
  const providers = Array.from(
    new Map(
      options.map((o) => [o.providerId, o.providerName]),
    ).entries(),
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Choose AI Model</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.modalLoading}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.modalLoadingText}>
              Loading providers from server…
            </Text>
          </View>
        ) : options.length === 0 ? (
          <View style={styles.modalEmpty}>
            <Ionicons
              name="alert-circle-outline"
              size={40}
              color={COLORS.textMuted}
            />
            <Text style={styles.modalEmptyTitle}>No models available</Text>
            <Text style={styles.modalEmptyText}>
              Make sure your opencode server has at least one AI provider
              configured with valid credentials.
            </Text>
          </View>
        ) : (
          <FlatList
            data={providers}
            keyExtractor={([id]) => id}
            renderItem={({ item: [providerId, providerName] }) => {
              const providerModels = options.filter(
                (o) => o.providerId === providerId,
              );
              return (
                <View style={styles.providerGroup}>
                  <Text style={styles.providerGroupLabel}>
                    {providerName.toUpperCase()}
                  </Text>
                  <View style={styles.providerGroupSection}>
                    {providerModels.map((option, idx) => {
                      const isSelected = option.modelId === selectedModelId;
                      return (
                        <React.Fragment key={option.modelId}>
                          <TouchableOpacity
                            style={styles.modelRow}
                            onPress={() => {
                              onSelect(option);
                              onClose();
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.modelRowLeft}>
                              <Text
                                style={[
                                  styles.modelName,
                                  isSelected && styles.modelNameSelected,
                                ]}
                                numberOfLines={1}
                              >
                                {option.modelName}
                              </Text>
                              {option.contextLength ? (
                                <Text style={styles.modelMeta}>
                                  {(option.contextLength / 1000).toFixed(0)}k
                                  ctx
                                </Text>
                              ) : null}
                            </View>
                            {isSelected ? (
                              <Ionicons
                                name="checkmark"
                                size={18}
                                color={COLORS.primary}
                              />
                            ) : null}
                          </TouchableOpacity>
                          {idx < providerModels.length - 1 ? (
                            <View
                              style={[
                                styles.divider,
                                { marginLeft: SPACING.md },
                              ]}
                            />
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Clone directory edit modal
// ---------------------------------------------------------------------------

interface CloneDirModalProps {
  visible: boolean;
  initial: string;
  onSave: (dir: string) => void;
  onClose: () => void;
}

function CloneDirModal({ visible, initial, onSave, onClose }: CloneDirModalProps) {
  const [value, setValue] = useState(initial);

  const handleSave = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) {
      onSave(trimmed);
    }
    onClose();
  }, [value, onSave, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Clone Directory</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.cloneDirBody}>
            <Text style={styles.cloneDirHint}>
              Absolute path on the server where repositories will be cloned.
            </Text>
            <TextInput
              style={styles.cloneDirInput}
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="~/projects/"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              selectTextOnFocus
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  // ── Store ────────────────────────────────────────────────────────────────
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);
  const isConnected = useConnectionStore((s) => s.isConnected);
  const cloneDirectory = useConnectionStore((s) => s.cloneDirectory);
  const setCloneDirectory = useConnectionStore((s) => s.setCloneDirectory);
  const clearConnection = useConnectionStore((s) => s.clearConnection);

  // ── Preferred model (stored per-session for now; global preference) ──────
  // We store it in the Zustand store as part of preferences. For this phase
  // we manage it locally and allow the user to pick; later phases will read
  // it when creating sessions.
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModelLabel, setSelectedModelLabel] = useState<string>('Default');

  // ── Modal visibility ─────────────────────────────────────────────────────
  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const [cloneDirModalVisible, setCloneDirModalVisible] = useState(false);

  // ── Providers ────────────────────────────────────────────────────────────
  const { options: modelOptions, isLoading: providersLoading } = useProviders();

  // ── GitHub Auth ──────────────────────────────────────────────────────────
  const {
    connect: githubConnect,
    disconnect: githubDisconnect,
    user: githubUser,
    isLoading: githubLoading,
    error: githubError,
  } = useGitHubAuth();

  // ── Server health (for version display) ──────────────────────────────────
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    enabled: serverUrl !== null && serverPassword !== null,
    queryFn: async () => {
      if (!serverUrl || !serverPassword) return null;
      const client = createOpenCodeClient({
        serverUrl,
        username: serverUsername,
        password: serverPassword,
      });
      return getHealth(client);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // ── App version from Expo Constants ──────────────────────────────────────
  const appVersion =
    (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleChangeServer = useCallback(() => {
    // Navigate to Connect screen in the root stack (reuses the existing screen)
    navigation.navigate('Connect');
  }, [navigation]);

  const handleDisconnectServer = useCallback(() => {
    Alert.alert(
      'Disconnect Server',
      'This will clear all stored credentials and return you to the onboarding screen. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            clearConnection();
            // Navigation reacts automatically via RootNavigator watching isConnected
          },
        },
      ],
    );
  }, [clearConnection]);

  const handleModelSelect = useCallback((option: ProviderModelOption) => {
    setSelectedModelId(option.modelId);
    setSelectedModelLabel(`${option.providerName} · ${option.modelName}`);
  }, []);

  const handleGitHubPress = useCallback(() => {
    if (githubUser) {
      Alert.alert(
        'GitHub Account',
        `Connected as @${githubUser.login}. Disconnect your GitHub account?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: githubDisconnect,
          },
        ],
      );
    } else {
      void githubConnect();
    }
  }, [githubUser, githubConnect, githubDisconnect]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const statusDotColor = isConnected ? COLORS.success : COLORS.error;
  const statusLabel = isConnected ? 'Connected' : 'Disconnected';

  const githubRowValue = githubLoading
    ? 'Connecting…'
    : githubUser
    ? `@${githubUser.login}`
    : 'Not connected';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── SERVER ─────────────────────────────────────────────────────── */}
        <SectionLabel title="SERVER" />
        <View style={styles.section}>
          <Row
            icon="server-outline"
            label="Server URL"
            value={serverUrl ?? 'Not set'}
            valueColor={serverUrl ? COLORS.text : COLORS.textMuted}
            onPress={handleChangeServer}
          />
          <Divider />
          <Row
            icon="person-outline"
            label="Username"
            value={serverUsername}
          />
          <Divider />
          <Row
            icon="ellipse"
            label="Status"
            rightElement={
              <View style={styles.statusRow}>
                <View
                  style={[styles.statusDot, { backgroundColor: statusDotColor }]}
                />
                <Text
                  style={[styles.rowValue, { color: statusDotColor }]}
                >
                  {statusLabel}
                </Text>
              </View>
            }
          />
          <Divider />
          <Row
            icon="swap-horizontal-outline"
            label="Change Server"
            onPress={handleChangeServer}
          />
        </View>

        {/* ── GITHUB ─────────────────────────────────────────────────────── */}
        <SectionLabel title="GITHUB" />
        <View style={styles.section}>
          <Row
            icon="logo-github"
            label="GitHub Account"
            onPress={handleGitHubPress}
            rightElement={
              <View style={styles.githubRight}>
                {githubLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : githubUser ? (
                  <>
                    {githubUser.avatarUrl ? (
                      <Image
                        source={{ uri: githubUser.avatarUrl }}
                        style={styles.avatar}
                      />
                    ) : null}
                    <Text style={[styles.rowValue, { color: COLORS.success }]}>
                      @{githubUser.login}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={COLORS.textMuted}
                    />
                  </>
                ) : (
                  <>
                    <Text style={[styles.rowValue, { color: COLORS.primary }]}>
                      Connect
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={COLORS.textMuted}
                    />
                  </>
                )}
              </View>
            }
          />
          {githubError ? (
            <View style={styles.githubError}>
              <Ionicons
                name="alert-circle"
                size={14}
                color={COLORS.error}
              />
              <Text style={styles.githubErrorText}>{githubError}</Text>
            </View>
          ) : null}
        </View>

        {/* ── PREFERENCES ────────────────────────────────────────────────── */}
        <SectionLabel title="PREFERENCES" />
        <View style={styles.section}>
          <Row
            icon="sparkles-outline"
            label="AI Model"
            value={selectedModelLabel}
            onPress={() => setModelPickerVisible(true)}
          />
          <Divider />
          <Row
            icon="folder-outline"
            label="Clone Directory"
            value={cloneDirectory}
            onPress={() => setCloneDirModalVisible(true)}
          />
        </View>

        {/* ── ABOUT ──────────────────────────────────────────────────────── */}
        <SectionLabel title="ABOUT" />
        <View style={styles.section}>
          <Row
            icon="information-circle-outline"
            label="App Version"
            value={appVersion}
          />
          <Divider />
          <Row
            icon="code-slash-outline"
            label="Server Version"
            value={healthData?.version ?? '—'}
          />
        </View>

        {/* ── ACCOUNT ────────────────────────────────────────────────────── */}
        <SectionLabel title="ACCOUNT" />
        <View style={styles.section}>
          <Row
            icon="log-out-outline"
            label="Disconnect Server"
            onPress={handleDisconnectServer}
            danger
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>DriftCode · MIT License</Text>
          <Text style={styles.footerText}>
            Not affiliated with the opencode team
          </Text>
        </View>
      </ScrollView>

      {/* Model picker modal */}
      <ModelPickerModal
        visible={modelPickerVisible}
        options={modelOptions}
        selectedModelId={selectedModelId}
        isLoading={providersLoading}
        onSelect={handleModelSelect}
        onClose={() => setModelPickerVisible(false)}
      />

      {/* Clone directory modal */}
      <CloneDirModal
        visible={cloneDirModalVisible}
        initial={cloneDirectory}
        onSave={setCloneDirectory}
        onClose={() => setCloneDirModalVisible(false)}
      />
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
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },

  // Section
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
    marginHorizontal: SPACING.md,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    minHeight: 48,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  rowLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  rowLabelDanger: {
    color: COLORS.error,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    maxWidth: '55%',
  },
  rowValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  // Status dot
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // GitHub
  githubRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  githubError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  githubErrorText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.xs,
  },
  footerText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },

  // ── Model picker modal ──────────────────────────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  modalLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  modalLoadingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  modalEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  modalEmptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  modalEmptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalList: {
    paddingBottom: SPACING.xl,
  },
  providerGroup: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  providerGroupLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  providerGroupSection: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    minHeight: 48,
  },
  modelRowLeft: {
    flex: 1,
    gap: 2,
  },
  modelName: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  modelNameSelected: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  modelMeta: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },

  // ── Clone directory modal ───────────────────────────────────────────────
  cloneDirBody: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cloneDirHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  cloneDirInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
