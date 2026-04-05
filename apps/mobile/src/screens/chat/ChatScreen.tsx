/**
 * ChatScreen — Phase 3
 *
 * Full agentic chat UI:
 *   - Creates a new session if none is active, or resumes the existing one.
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
  createSession,
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
import { MessageBubble, TypingIndicator } from './MessageBubble';
import type { ChatScreenProps } from '../../navigation/types';

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
export function ChatScreen({ route }: ChatScreenProps) {
  // ── Store ────────────────────────────────────────────────────────────────
  const activeSessionId = useConnectionStore((s) => s.activeSessionId);
  const setActiveSessionId = useConnectionStore((s) => s.setActiveSessionId);

  // The tab can receive a sessionId param (e.g. tapped from Sessions tab).
  const routeSessionId = route.params?.sessionId ?? null;
  // A pre-filled message to send automatically once the session is ready
  // (e.g. a clone instruction from the Projects tab).
  const initialMessage = route.params?.initialMessage ?? null;

  // Effective session: param > store > null
  const sessionId = routeSessionId ?? activeSessionId;

  // ── Session state ────────────────────────────────────────────────────────
  const [session, setSession] = useState<Session | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const client = useOpenCodeClient();
  const queryClient = useQueryClient();

  // Load or create a session on mount / when sessionId changes.
  useEffect(() => {
    if (!client) return;

    if (sessionId) {
      // Try to load the existing session metadata.
      getSession(client, sessionId)
        .then(setSession)
        .catch(() => {
          // Session no longer exists — clear it and create a fresh one.
          setActiveSessionId(null);
        });
    }
    // If sessionId is null we wait for the user to tap "New session".
  }, [sessionId, client, setActiveSessionId]);

  const handleNewSession = useCallback(async () => {
    if (!client) return;
    setIsCreatingSession(true);
    try {
      const newSession = await createSession(client, {});
      setSession(newSession);
      setActiveSessionId(newSession.id);
      // Clear the message cache for the new session.
      queryClient.removeQueries({ queryKey: messageKeys.session(newSession.id) });
    } catch (err) {
      Alert.alert(
        'Could not create session',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setIsCreatingSession(false);
    }
  }, [client, setActiveSessionId, queryClient]);

  // ── Messages ─────────────────────────────────────────────────────────────
  const { messages, isLoading, isStreaming } = useMessages(sessionId);
  const { send, isSending } = useSendMessage(sessionId);

  // ── Slash commands ───────────────────────────────────────────────────────
  const commands = useCommands();
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
            const idx = list.findIndex((m) => m.id === message.id);
            if (idx === -1) return [...list, message];
            const next = [...list];
            next[idx] = message;
            return next;
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
  const listRef = useRef<FlatList<Message>>(null);

  // Auto-scroll to bottom whenever messages change.
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay ensures the layout has settled.
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isStreaming]);

  // ── Slash command suggestion logic ───────────────────────────────────────
  // Show suggestions whenever the input starts with "/" and has no space yet
  // (i.e. user hasn't started typing arguments after the command name).
  const commandQuery = inputText.startsWith('/')
    ? inputText.slice(1).split(' ')[0]
    : '';

  const showCommandSuggestions =
    sessionId !== null &&
    inputText.startsWith('/') &&
    !inputText.includes(' ') &&
    commands.length > 0;

  const filteredCommands = useMemo<Command[]>(() => {
    if (!showCommandSuggestions) return [];
    if (commandQuery === '') return commands;
    const q = commandQuery.toLowerCase();
    return commands.filter((cmd) => cmd.name.toLowerCase().startsWith(q));
  }, [showCommandSuggestions, commandQuery, commands]);

  const handleSelectCommand = useCallback((cmd: Command) => {
    // Fill the input with the command name + a trailing space so the user
    // can immediately start typing arguments if needed.
    setInputText(`/${cmd.name} `);
  }, []);

  // ── Send handler ─────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isBusy || !sessionId) return;
    setInputText('');

    if (text.startsWith('/')) {
      // Route slash commands to POST /session/:id/command
      const spaceIdx = text.indexOf(' ');
      const name = spaceIdx === -1 ? text.slice(1) : text.slice(1, spaceIdx);
      const args = spaceIdx === -1 ? '' : text.slice(spaceIdx + 1).trim();
      void runSlashCommand(name, args);
    } else {
      send(text);
    }
  }, [inputText, isBusy, sessionId, send, runSlashCommand]);

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: Message }) => <MessageBubble message={item} />,
    [],
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  // Must be a function reference, never a pre-rendered element — VirtualizedList
  // requires a component type or render fn for ListFooterComponent, not JSX.
  const ListFooter = isStreaming ? TypingIndicator : null;

  // ── No session state ─────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header session={null} onNewSession={handleNewSession} isCreating={isCreatingSession} />
        <View style={styles.empty}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={56}
            color={COLORS.textMuted}
          />
          <Text style={styles.emptyTitle}>No active session</Text>
          <Text style={styles.emptyBody}>
            Tap the button above to start a new AI coding session, or open one
            from the Sessions tab.
          </Text>
          <TouchableOpacity
            style={styles.newSessionBtn}
            onPress={handleNewSession}
            disabled={isCreatingSession}
          >
            {isCreatingSession ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="add" size={18} color={COLORS.white} />
                <Text style={styles.newSessionBtnText}>New session</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main chat UI ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header session={session} onNewSession={handleNewSession} isCreating={isCreatingSession} />

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
            ListFooterComponent={ListFooter}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>
                  Send a message or type / to run a command.
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
            // Keep list scrolled to the latest message.
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          />
        )}

        {/* Slash command suggestions — shown above the composer */}
        {showCommandSuggestions && filteredCommands.length > 0 && (
          <View style={styles.commandSuggestions}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.commandSuggestionsScroll}
            >
              {filteredCommands.map((cmd) => (
                <TouchableOpacity
                  key={cmd.name}
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
              ))}
            </ScrollView>
          </View>
        )}

        {/* Composer */}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Header sub-component
// ---------------------------------------------------------------------------
interface HeaderProps {
  session: Session | null;
  onNewSession: () => void;
  isCreating: boolean;
}

function Header({ session, onNewSession, isCreating }: HeaderProps) {
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
      <TouchableOpacity
        style={styles.headerBtn}
        onPress={onNewSession}
        disabled={isCreating}
      >
        {isCreating ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
        )}
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
  // ── Empty / loading ──────────────────────────────────────────────────────
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
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
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
    minHeight: MIN_TOUCH_TARGET,
  },
  newSessionBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.white,
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
