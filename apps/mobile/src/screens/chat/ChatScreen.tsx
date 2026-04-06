/**
 * ChatScreen — Phase 3
 *
 * Full agentic chat UI:
 *   - Loads an existing session and renders its conversation.
 *   - Renders the message list via a FlatList (auto-scrolls to the bottom).
 *   - Streams assistant messages live via the SSE event stream.
 *   - Shows a typing indicator while the AI is generating.
 *   - Expanding TextInput composer with a send button.
 *   - Slash command autocomplete: typing "/" shows all available server
 *     commands; selecting one fills the input and routes execution through
 *     POST /session/:id/command instead of prompt_async.
 *   - Header shows session title and a "New session" button.
 */
import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import {
  createOpenCodeClient,
  getSession,
  executeCommand,
} from '@driftcode/opencode-client';
import type { Session, Message, Command } from '@driftcode/opencode-client';

import {
  COLORS,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
  MIN_TOUCH_TARGET,
} from '../../constants';
import { useConnectionStore } from '../../store';
import { useMessages, messageKeys } from '../../hooks/useMessages';
import { useSendMessage } from '../../hooks/useSendMessage';
import { useCommands } from '../../hooks/useCommands';
import { MessageBubble } from './MessageBubble';
import { ReasoningBlock } from './ReasoningBlock';
import { ToolCallCard } from './ToolCallCard';
import type { ConversationScreenProps } from '../../navigation/types';

// ---------------------------------------------------------------------------
// Helper — build the opencode client from the store
// ---------------------------------------------------------------------------
function useOpenCodeClient() {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const serverUsername = useConnectionStore((s) => s.serverUsername);
  const serverPassword = useConnectionStore((s) => s.serverPassword);

  if (!serverUrl || !serverPassword) return null;

  return createOpenCodeClient({
    serverUrl,
    username: serverUsername,
    password: serverPassword,
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export function ChatScreen({ route, navigation }: ConversationScreenProps) {
  // ── Store ────────────────────────────────────────────────────────────────
  const setActiveSessionId = useConnectionStore((s) => s.setActiveSessionId);
  const activeFileContext = useConnectionStore((s) => s.activeFileContext);
  const clearActiveFileContext = useConnectionStore((s) => s.clearActiveFileContext);

  const routeSessionId = route.params.sessionId;
  // A pre-filled message to send automatically once the session is ready
  // (e.g. a clone instruction from the Projects tab).
  const initialMessage = route.params.initialMessage ?? null;
  const sessionId = routeSessionId;

  const scopedFileContext = useMemo(() => {
    if (!activeFileContext) return null;
    if (!activeFileContext.sessionId || activeFileContext.sessionId === sessionId) {
      return activeFileContext;
    }
    return null;
  }, [activeFileContext, sessionId]);

  // ── Session state ────────────────────────────────────────────────────────
  const [session, setSession] = useState<Session | null>(null);

  const client = useOpenCodeClient();
  const queryClient = useQueryClient();

  // Load the existing session metadata.
  useEffect(() => {
    if (!client) return;
    getSession(client, sessionId)
      .then(setSession)
      .catch(() => {
        Alert.alert('Session not found', 'This session may have been deleted.');
        navigation.goBack();
      });
    setActiveSessionId(sessionId);
  }, [sessionId, client, setActiveSessionId, navigation]);

  // ── Messages ─────────────────────────────────────────────────────────────
  const { messages, isLoading, isStreaming } = useMessages(sessionId);
  const { send, isSending } = useSendMessage(sessionId);

  // ── Slash commands ───────────────────────────────────────────────────────
  const {
    commands,
    isLoading: isLoadingCommands,
    error: commandsError,
    refetch: refetchCommands,
  } = useCommands(sessionId);
  const [isRunningCommand, setIsRunningCommand] = useState(false);

  const isBusy = isSending || isRunningCommand;

  const runSlashCommand = useCallback(
    async (commandName: string, commandArgs: string) => {
      if (!client || !sessionId) return;
      setIsRunningCommand(true);
      try {
        const message = await executeCommand(client, sessionId, {
          command: commandName,
          arguments: commandArgs,
        });
        // Push the returned message directly into the cache.
        // Subsequent SSE updates will patch it in place if the server
        // emits follow-up message.updated events.
        queryClient.setQueryData<Message[]>(
          messageKeys.session(sessionId),
          (prev) => {
            const list = prev ?? [];
            const deduped = new Map<string, Message>();
            for (const item of list) deduped.set(item.id, item);
            deduped.set(message.id, message);
            const merged = Array.from(deduped.values()).sort(
              (a, b) => a.createdAt - b.createdAt,
            );
            const idx = merged.findIndex((m) => m.id === message.id);
            if (idx === -1) return merged;
            const next = [...list];
            next[idx] = message;
            return merged;
          },
        );
      } catch (err) {
        Alert.alert(
          'Command failed',
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setIsRunningCommand(false);
      }
    },
    [client, sessionId, queryClient],
  );

  // ── Auto-send initialMessage once session + send are ready ───────────────
  const initialMessageSentRef = useRef(false);
  useEffect(() => {
    if (
      initialMessage &&
      sessionId &&
      !isLoading &&
      !isBusy &&
      !initialMessageSentRef.current
    ) {
      initialMessageSentRef.current = true;
      send(initialMessage);
    }
  }, [initialMessage, sessionId, isLoading, isBusy, send]);

  // ── Composer state ───────────────────────────────────────────────────────
  const [inputText, setInputText] = useState('');
  const [showThinkingDetails, setShowThinkingDetails] = useState(false);
  const [activityModalMessage, setActivityModalMessage] = useState<Message | null>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const hasInitialScrollRef = useRef(false);
  const prevSessionIdRef = useRef<string | null>(sessionId);

  // Reset initial-scroll flag when switching conversations.
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      hasInitialScrollRef.current = false;
    }
  }, [sessionId]);

  // On first load of a conversation, jump to newest messages immediately.
  useEffect(() => {
    if (!isLoading && messages.length > 0 && !hasInitialScrollRef.current) {
      hasInitialScrollRef.current = true;
      // Small delay ensures layout is measured before initial jump.
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [isLoading, messages.length]);

  // After initial positioning, keep following new messages.
  useEffect(() => {
    if (messages.length > 0 && hasInitialScrollRef.current) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const latestThinkingText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.role !== 'assistant') continue;
      const reasoningParts = msg.parts.filter((part) =>
        part.type === 'reasoning' && typeof part.reasoning === 'string' && part.reasoning.trim().length > 0,
      );
      if (reasoningParts.length === 0) continue;
      return reasoningParts
        .map((part) => (part.type === 'reasoning' ? part.reasoning : ''))
        .filter((text) => text.length > 0)
        .join('\n\n')
        .trim();
    }
    return null;
  }, [messages]);

  const getPublicParts = useCallback((message: Message) => {
    if (message.role === 'user') return message.parts;
    return message.parts.filter(
      (part) =>
        (part.type === 'text' && part.text.trim().length > 0) ||
        part.type === 'file',
    );
  }, []);

  const getInternalParts = useCallback((message: Message) => {
    if (message.role !== 'assistant') return [] as Message['parts'];
    return message.parts.filter(
      (part) =>
        part.type === 'reasoning' ||
        part.type === 'tool-invocation' ||
        part.type === 'step-start',
    );
  }, []);

  const buildActivitySummary = useCallback((message: Message) => {
    const internalParts = getInternalParts(message);
    if (internalParts.length === 0) return null;

    const toolCount = internalParts.filter((part) => part.type === 'tool-invocation').length;
    const hasThinking = internalParts.some((part) => part.type === 'reasoning');

    if (toolCount > 0 && hasThinking) {
      return `Thinking • ${toolCount} tool action${toolCount > 1 ? 's' : ''}`;
    }
    if (toolCount > 0) {
      return `${toolCount} tool action${toolCount > 1 ? 's' : ''}`;
    }
    return 'Thinking';
  }, [getInternalParts]);

  // ── Slash command suggestion logic ───────────────────────────────────────
  // Show suggestions whenever the input starts with "/" and has no space yet
  // (i.e. user hasn't started typing arguments after the command name).
  const commandQuery = inputText.startsWith('/')
    ? inputText.slice(1).split(' ')[0]
    : '';

  const showCommandSuggestions =
    inputText.startsWith('/') &&
    !inputText.includes(' ');

  const filteredCommands = useMemo<Command[]>(() => {
    if (!showCommandSuggestions) return [];
    if (commandQuery === '') return commands;
    const q = commandQuery.toLowerCase();
    return commands.filter((cmd) => cmd.name.toLowerCase().startsWith(q));
  }, [showCommandSuggestions, commandQuery, commands]);

  useEffect(() => {
    if (showCommandSuggestions) {
      void refetchCommands();
    }
  }, [showCommandSuggestions, refetchCommands]);

  const handleSelectCommand = useCallback((cmd: Command) => {
    // Fill the input with the command name + a trailing space so the user
    // can immediately start typing arguments if needed.
    setInputText(`/${cmd.name} `);
  }, []);

  // ── Send handler ─────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isBusy) return;
    setInputText('');

    if (text.startsWith('/')) {
      // Route slash commands to POST /session/:id/command
      const spaceIdx = text.indexOf(' ');
      const name = spaceIdx === -1 ? text.slice(1) : text.slice(1, spaceIdx);
      const args = spaceIdx === -1 ? '' : text.slice(spaceIdx + 1).trim();
      void runSlashCommand(name, args);
    } else {
      if (scopedFileContext) {
        const snippet = scopedFileContext.snippet?.trim();
        const contextPrefix =
          `Context file: \`${scopedFileContext.filePath}\`\n` +
          (snippet
            ? `\nRelevant snippet:\n\`\`\`\n${snippet}\n\`\`\`\n\n`
            : '\n');
        send(`${contextPrefix}${text}`);
      } else {
        send(text);
      }
    }
  }, [inputText, isBusy, sessionId, send, runSlashCommand, scopedFileContext]);

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: Message }) => {
    const publicParts = getPublicParts(item);
    const internalParts = getInternalParts(item);
    const summary = buildActivitySummary(item);
    const shouldShowBubble = item.role === 'user' || publicParts.length > 0;

    if (!shouldShowBubble && internalParts.length === 0) return null;

    const displayMessage: Message = shouldShowBubble
      ? {
        ...item,
        parts: item.role === 'assistant' ? publicParts : item.parts,
      }
      : item;

    return (
      <View>
        {shouldShowBubble ? <MessageBubble message={displayMessage} /> : null}
        {item.role === 'assistant' && summary ? (
          <TouchableOpacity
            style={styles.activityRow}
            onPress={() => setActivityModalMessage(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="analytics-outline" size={12} color={COLORS.warning} />
            <Text style={styles.activityText}>{summary}</Text>
            <Text style={styles.activityLink}>View</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }, [buildActivitySummary, getInternalParts, getPublicParts]);

  const duplicateMessageIds = useMemo(() => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const msg of messages) {
      if (seen.has(msg.id)) duplicates.push(msg.id);
      else seen.add(msg.id);
    }
    return duplicates;
  }, [messages]);

  useEffect(() => {
    if (__DEV__ && duplicateMessageIds.length > 0) {
      console.warn(
        '[ChatScreen] Duplicate message IDs detected in FlatList data:',
        duplicateMessageIds,
      );
    }
  }, [duplicateMessageIds]);

  const keyExtractor = useCallback((item: Message, index: number) => {
    if (typeof item.id === 'string' && item.id.trim().length > 0) {
      return item.id;
    }

    const createdAt = typeof item.createdAt === 'number' ? item.createdAt : 0;
    return `${item.role}-${createdAt}-${index}`;
  }, []);

  // Must be a function reference, never a pre-rendered element — VirtualizedList
  // requires a component type or render fn for ListFooterComponent, not JSX.
  // ── Main chat UI ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header session={session} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Message list */}
        {isLoading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>
                  Send a message or type / to run a command.
                </Text>
              </View>
            }
            showsVerticalScrollIndicator
            indicatorStyle="white"
            persistentScrollbar
          />
        )}

        {isStreaming && (
          <View style={styles.thinkingStatusBar}>
            <View style={styles.thinkingStatusMain}>
              <ActivityIndicator size="small" color={COLORS.warning} />
              <Text style={styles.thinkingStatusText}>AI is thinking…</Text>
            </View>
            {latestThinkingText ? (
              <TouchableOpacity
                style={styles.thinkingToggle}
                onPress={() => setShowThinkingDetails((v) => !v)}
              >
                <Text style={styles.thinkingToggleText}>
                  {showThinkingDetails ? 'Hide' : 'View'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {isStreaming && showThinkingDetails && latestThinkingText ? (
          <View style={styles.thinkingPanel}>
            <ReasoningBlock reasoning={latestThinkingText} />
          </View>
        ) : null}

        {/* Slash command suggestions — shown above the composer */}
        {showCommandSuggestions && (
          <View style={styles.commandSuggestions}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.commandSuggestionsScroll}
            >
              {isLoadingCommands ? (
                <View style={styles.commandStateRow}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.commandStateText}>Loading commands…</Text>
                </View>
              ) : commandsError ? (
                <View style={styles.commandStateRow}>
                  <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.commandStateText} numberOfLines={2}>
                    Could not load commands. Try typing / again or enter command manually.
                  </Text>
                </View>
              ) : filteredCommands.length === 0 ? (
                <View style={styles.commandStateRow}>
                  <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.commandStateText}>
                    {commandQuery ? 'No matching commands.' : 'No commands available.'}
                  </Text>
                </View>
              ) : (
                filteredCommands.map((cmd, idx) => (
                  <TouchableOpacity
                    key={`${cmd.type ?? 'unknown'}-${cmd.name}-${idx}`}
                    style={styles.commandItem}
                    onPress={() => { handleSelectCommand(cmd); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.commandItemName}>/{cmd.name}</Text>
                    {cmd.description ? (
                      <Text style={styles.commandItemDesc} numberOfLines={1}>
                        {cmd.description}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {/* Composer */}
        {scopedFileContext && (
          <View style={styles.fileContextRow}>
            <Ionicons name="document-text-outline" size={14} color={COLORS.info} />
            <Text style={styles.fileContextText} numberOfLines={1}>
              {scopedFileContext.filePath}
            </Text>
            <TouchableOpacity
              style={styles.fileContextClear}
              onPress={clearActiveFileContext}
            >
              <Text style={styles.fileContextClearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask anything or type / for commands…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={32_000}
            returnKeyType="default"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || isBusy) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isBusy}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="arrow-up" size={18} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>

        <Modal
          visible={activityModalMessage !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setActivityModalMessage(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>AI Internal Activity</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setActivityModalMessage(null)}
                >
                  <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {(activityModalMessage?.parts ?? [])
                  .filter(
                    (part) =>
                      part.type === 'reasoning' ||
                      part.type === 'tool-invocation' ||
                      part.type === 'step-start',
                  )
                  .map((part, idx) => {
                    if (part.type === 'reasoning') {
                      return (
                        <ReasoningBlock
                          key={`modal-reasoning-${idx}`}
                          reasoning={part.reasoning}
                        />
                      );
                    }
                    if (part.type === 'tool-invocation') {
                      return (
                        <ToolCallCard
                          key={`modal-tool-${part.toolInvocation.toolCallId}-${idx}`}
                          toolInvocation={part.toolInvocation}
                        />
                      );
                    }
                    return (
                      <View key={`modal-step-${idx}`} style={styles.modalStepRow}>
                        <Ionicons name="ellipse" size={6} color={COLORS.textMuted} />
                        <Text style={styles.modalStepText}>Step transition</Text>
                      </View>
                    );
                  })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Header sub-component
// ---------------------------------------------------------------------------
interface HeaderProps {
  session: Session | null;
}

function Header({ session }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {session?.title ?? (session ? 'Untitled session' : 'Chat')}
        </Text>
        {session && (
          <Text style={styles.headerSub} numberOfLines={1}>
            {session.id.slice(0, 8)}
          </Text>
        )}
      </View>
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
  flex: {
    flex: 1,
  },
  // ── Header ──────────────────────────────────────────────────────────────
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
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 1,
    fontFamily: 'Courier',
  },
  headerBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── List ─────────────────────────────────────────────────────────────────
  listContent: {
    paddingVertical: SPACING.sm,
    flexGrow: 1,
  },
  emptyList: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
  },
  emptyListText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  // ── Slash command suggestions ─────────────────────────────────────────────
  commandSuggestions: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    maxHeight: 220,
  },
  commandSuggestionsScroll: {
    flexGrow: 0,
  },
  commandItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  commandItemName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  commandItemDesc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  commandStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  commandStateText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginLeft: SPACING.md + 28 + SPACING.xs,
    marginTop: -2,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
  },
  activityText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  activityLink: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  thinkingStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.surface,
  },
  thinkingStatusMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  thinkingStatusText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.warning,
    fontWeight: '600',
  },
  thinkingToggle: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
  },
  thinkingToggleText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  thinkingPanel: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  fileContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.surface,
  },
  fileContextText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.info,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fileContextClear: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
  },
  fileContextClearText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
  },
  modalBody: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  modalStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 6,
  },
  modalStepText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  // ── Composer ─────────────────────────────────────────────────────────────
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    maxHeight: 160,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  sendBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.surfaceHover,
  },
});
