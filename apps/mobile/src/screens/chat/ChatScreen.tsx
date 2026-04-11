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
  shareSession,
  unshareSession,
  forkSession,
  revertSession,
  unrevertSession,
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
import { useProviders } from '../../hooks/useProviders';
import { useAgents } from '../../hooks/useAgents';
import { MessageBubble } from './MessageBubble';
import { ReasoningBlock } from './ReasoningBlock';
import { ToolCallCard } from './ToolCallCard';
import type { ConversationScreenProps } from '../../navigation/types';

const RUNTIME_SLASH_COMMANDS: Command[] = [
  {
    name: 'agent',
    description: 'choose the active agent for this session',
    type: 'builtin',
  },
  {
    name: 'model',
    description: 'choose the active model for this session',
    type: 'builtin',
  },
  {
    name: 'models',
    description: 'alias for /model',
    type: 'builtin',
  },
  {
    name: 'variant',
    description: 'set a variant override for this session',
    type: 'builtin',
  },
];

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
  const routeSessionId = route.params.sessionId;
  const sessionId = routeSessionId;

  const setActiveSessionId = useConnectionStore((s) => s.setActiveSessionId);
  const activeFileContext = useConnectionStore((s) => s.activeFileContext);
  const clearActiveFileContext = useConnectionStore((s) => s.clearActiveFileContext);
  const runtimeControls = useConnectionStore((s) =>
    sessionId ? s.sessionRuntimeControls[sessionId] : undefined,
  );
  const setSessionAgent = useConnectionStore((s) => s.setSessionAgent);
  const setSessionModel = useConnectionStore((s) => s.setSessionModel);
  const setSessionVariant = useConnectionStore((s) => s.setSessionVariant);

  // A pre-filled message to send automatically once the session is ready
  // (e.g. a clone instruction from the Projects tab).
  const initialMessage = route.params.initialMessage ?? null;

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
  const {
    options: providerOptions,
    isLoading: isLoadingProviders,
    refresh: refreshProviders,
  } = useProviders();
  const {
    agents,
    isLoading: isLoadingAgents,
    refetch: refetchAgents,
  } = useAgents();

  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [agentPickerVisible, setAgentPickerVisible] = useState(false);
  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const [variantModalVisible, setVariantModalVisible] = useState(false);
  const [variantDraft, setVariantDraft] = useState('');

  const isBusy = isSending || isRunningCommand;

  const selectedModel = useMemo(
    () =>
      providerOptions.find(
        (option) =>
          option.providerId === runtimeControls?.model?.providerID &&
          option.modelId === runtimeControls?.model?.modelID,
      ) ?? null,
    [providerOptions, runtimeControls?.model?.providerID, runtimeControls?.model?.modelID],
  );

  useEffect(() => {
    setVariantDraft(runtimeControls?.variant ?? '');
  }, [runtimeControls?.variant]);

  const selectedAgentName = runtimeControls?.agent ?? null;
  const selectedVariant = runtimeControls?.variant ?? null;

  const modelProviderGroups = useMemo(
    () =>
      Array.from(new Map(providerOptions.map((o) => [o.providerId, o.providerName])).entries()),
    [providerOptions],
  );

  const applyAgentSelection = useCallback(
    (agentName: string | null) => {
      if (!sessionId) return;
      setSessionAgent(sessionId, agentName);
      setAgentPickerVisible(false);
    },
    [sessionId, setSessionAgent],
  );

  const applyModelSelection = useCallback(
    (providerId: string, modelId: string) => {
      if (!sessionId) return;
      setSessionModel(sessionId, {
        providerID: providerId,
        modelID: modelId,
      });
      setModelPickerVisible(false);
    },
    [sessionId, setSessionModel],
  );

  const applyVariantSelection = useCallback(
    (value: string | null) => {
      if (!sessionId) return;
      setSessionVariant(sessionId, value);
      setVariantModalVisible(false);
    },
    [sessionId, setSessionVariant],
  );

  const runSlashCommand = useCallback(
    async (commandName: string, commandArgs: string) => {
      if (!client || !sessionId) return;
      setIsRunningCommand(true);
      try {
        const normalizedName = commandName.trim().toLowerCase();

        if (normalizedName === 'agent') {
          if (commandArgs.trim()) {
            const desired = commandArgs.trim().toLowerCase();
            if (desired === 'default' || desired === 'none' || desired === 'clear') {
              setSessionAgent(sessionId, null);
              return;
            }
            const matched = agents.find((agent) => agent.name.toLowerCase() === desired);
            if (matched) {
              setSessionAgent(sessionId, matched.name);
              return;
            }
          }
          setAgentPickerVisible(true);
          return;
        }

        if (normalizedName === 'model' || normalizedName === 'models') {
          if (commandArgs.trim()) {
            const desired = commandArgs.trim().toLowerCase();
            if (desired === 'default' || desired === 'none' || desired === 'clear') {
              setSessionModel(sessionId, null);
              return;
            }
            const matched = providerOptions.find((option) => {
              const modelOnly = option.modelId.toLowerCase();
              const scoped = `${option.providerId.toLowerCase()}:${modelOnly}`;
              return desired === modelOnly || desired === scoped;
            });
            if (matched) {
              setSessionModel(sessionId, {
                providerID: matched.providerId,
                modelID: matched.modelId,
              });
              return;
            }
          }
          setModelPickerVisible(true);
          return;
        }

        if (normalizedName === 'variant') {
          const nextVariant = commandArgs.trim();
          if (nextVariant) {
            if (
              nextVariant.toLowerCase() === 'default' ||
              nextVariant.toLowerCase() === 'none' ||
              nextVariant.toLowerCase() === 'clear'
            ) {
              setSessionVariant(sessionId, null);
              return;
            }
            setSessionVariant(sessionId, nextVariant);
            return;
          }
          setVariantModalVisible(true);
          return;
        }

        if (normalizedName === 'share') {
          await shareSession(client, sessionId);
          Alert.alert('Session shared', 'Share link created for this session.');
          await queryClient.invalidateQueries({ queryKey: ['sessions'] });
          return;
        }

        if (normalizedName === 'unshare') {
          await unshareSession(client, sessionId);
          Alert.alert('Session unshared', 'Share link removed for this session.');
          await queryClient.invalidateQueries({ queryKey: ['sessions'] });
          return;
        }

        if (normalizedName === 'fork') {
          const forked = await forkSession(client, sessionId);
          setActiveSessionId(forked.id);
          navigation.replace('Conversation', { sessionId: forked.id });
          return;
        }

        if (normalizedName === 'undo') {
          const lastUser = [...messages].reverse().find((msg) => msg.role === 'user');
          if (!lastUser) {
            Alert.alert('Nothing to undo', 'No user message found to revert.');
            return;
          }
          await revertSession(client, sessionId, lastUser.id);
          await queryClient.invalidateQueries({ queryKey: messageKeys.session(sessionId) });
          return;
        }

        if (normalizedName === 'redo') {
          await unrevertSession(client, sessionId);
          await queryClient.invalidateQueries({ queryKey: messageKeys.session(sessionId) });
          return;
        }

        const message = await executeCommand(client, sessionId, {
          command: commandName,
          arguments: commandArgs,
          ...(runtimeControls?.agent ? { agent: runtimeControls.agent } : {}),
          ...(runtimeControls?.model ? { model: runtimeControls.model } : {}),
          ...(runtimeControls?.variant ? { variant: runtimeControls.variant } : {}),
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
    [
      client,
      sessionId,
      queryClient,
      setActiveSessionId,
      navigation,
      messages,
      agents,
      providerOptions,
      runtimeControls?.agent,
      runtimeControls?.model,
      runtimeControls?.variant,
      setSessionAgent,
      setSessionModel,
      setSessionVariant,
    ],
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
  const pendingInitialScrollRef = useRef(false);
  const prevSessionIdRef = useRef<string | null>(sessionId);

  const scrollToLatest = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
      if (!animated) {
        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: false });
        }, 80);
      }
    });
  }, []);

  // Reset initial-scroll flag when switching conversations.
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      hasInitialScrollRef.current = false;
      pendingInitialScrollRef.current = true;
    }
  }, [sessionId]);

  // Ensure initial sessions with preloaded content also request a bottom jump.
  useEffect(() => {
    if (!isLoading && messages.length > 0 && !hasInitialScrollRef.current) {
      pendingInitialScrollRef.current = true;
      scrollToLatest(false);
    }
  }, [isLoading, messages.length, scrollToLatest]);

  const lastMessageFingerprint = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last) return '';

    const tail = last.parts[last.parts.length - 1];
    let tailSig: string = tail?.type ?? 'none';

    if (tail?.type === 'text') {
      tailSig = `text:${tail.text.length}`;
    } else if (tail?.type === 'reasoning') {
      tailSig = `reasoning:${tail.reasoning.length}`;
    } else if (tail?.type === 'tool-invocation') {
      tailSig = `tool:${tail.toolInvocation.state}`;
    }

    return `${messages.length}:${last.id}:${last.parts.length}:${tailSig}`;
  }, [messages]);

  // After initial positioning, keep following new messages.
  useEffect(() => {
    if (messages.length > 0 && hasInitialScrollRef.current) {
      scrollToLatest(true);
    }
  }, [lastMessageFingerprint, messages.length, scrollToLatest]);

  const handleListContentSizeChange = useCallback(() => {
    if (isLoading || messages.length === 0) return;

    if (!hasInitialScrollRef.current || pendingInitialScrollRef.current) {
      hasInitialScrollRef.current = true;
      pendingInitialScrollRef.current = false;
      scrollToLatest(false);
    }
  }, [isLoading, messages.length, scrollToLatest]);

  const handleListLayout = useCallback(() => {
    if (isLoading || messages.length === 0) return;
    if (!hasInitialScrollRef.current || pendingInitialScrollRef.current) {
      scrollToLatest(false);
    }
  }, [isLoading, messages.length, scrollToLatest]);

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

  const allCommands = useMemo<Command[]>(() => {
    const deduped = new Map<string, Command>();
    for (const cmd of [...commands, ...RUNTIME_SLASH_COMMANDS]) {
      deduped.set(cmd.name.toLowerCase(), cmd);
    }
    return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [commands]);

  const filteredCommands = useMemo<Command[]>(() => {
    if (!showCommandSuggestions) return [];
    if (commandQuery === '') return allCommands;
    const q = commandQuery.toLowerCase();
    return allCommands.filter((cmd) => cmd.name.toLowerCase().startsWith(q));
  }, [showCommandSuggestions, commandQuery, allCommands]);

  useEffect(() => {
    if (showCommandSuggestions) {
      void refetchCommands();
      void refetchAgents();
      void refreshProviders();
    }
  }, [showCommandSuggestions, refetchCommands, refetchAgents, refreshProviders]);

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
            onLayout={handleListLayout}
            onContentSizeChange={handleListContentSizeChange}
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
              {isLoadingCommands || isLoadingAgents || isLoadingProviders ? (
                <View style={styles.commandStateRow}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.commandStateText}>Loading command controls…</Text>
                </View>
              ) : filteredCommands.length === 0 ? (
                <View style={styles.commandStateRow}>
                  <Ionicons
                    name={commandsError ? 'warning-outline' : 'search-outline'}
                    size={16}
                    color={commandsError ? COLORS.warning : COLORS.textSecondary}
                  />
                  <Text style={styles.commandStateText}>
                    {commandsError
                      ? 'Could not load server commands. Runtime controls are still available.'
                      : commandQuery
                        ? 'No matching commands.'
                        : 'No commands available.'}
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

        <View style={styles.runtimeControlsRow}>
          <TouchableOpacity
            style={styles.runtimeChip}
            onPress={() => setAgentPickerVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.runtimeChipLabel}>Agent</Text>
            <Text style={styles.runtimeChipValue} numberOfLines={1}>
              {selectedAgentName ?? 'default'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.runtimeChip}
            onPress={() => setModelPickerVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.runtimeChipLabel}>Model</Text>
            <Text style={styles.runtimeChipValue} numberOfLines={1}>
              {selectedModel ? `${selectedModel.providerName} · ${selectedModel.modelName}` : 'default'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.runtimeChip}
            onPress={() => setVariantModalVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.runtimeChipLabel}>Variant</Text>
            <Text style={styles.runtimeChipValue} numberOfLines={1}>
              {selectedVariant ?? 'default'}
            </Text>
          </TouchableOpacity>
        </View>

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
          visible={agentPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAgentPickerVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.pickerModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Agent</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setAgentPickerVisible(false)}
                >
                  <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => applyAgentSelection(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerItemLabel}>Default</Text>
                  {!selectedAgentName ? (
                    <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>

                {isLoadingAgents ? (
                  <View style={styles.commandStateRow}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.commandStateText}>Loading agents…</Text>
                  </View>
                ) : agents.length === 0 ? (
                  <View style={styles.commandStateRow}>
                    <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.commandStateText}>No agents available on this server.</Text>
                  </View>
                ) : (
                  agents.map((agent) => {
                    const isSelected = selectedAgentName === agent.name;
                    return (
                      <TouchableOpacity
                        key={agent.name}
                        style={styles.pickerItem}
                        onPress={() => applyAgentSelection(agent.name)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.pickerItemTextWrap}>
                          <Text style={styles.pickerItemLabel}>{agent.name}</Text>
                          {agent.description ? (
                            <Text style={styles.pickerItemDescription} numberOfLines={2}>
                              {agent.description}
                            </Text>
                          ) : null}
                        </View>
                        {isSelected ? (
                          <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={modelPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModelPickerVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.pickerModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Model</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setModelPickerVisible(false)}
                >
                  <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    if (!sessionId) return;
                    setSessionModel(sessionId, null);
                    setModelPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerItemLabel}>Default</Text>
                  {!selectedModel ? (
                    <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>

                {isLoadingProviders ? (
                  <View style={styles.commandStateRow}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.commandStateText}>Loading models…</Text>
                  </View>
                ) : providerOptions.length === 0 ? (
                  <View style={styles.commandStateRow}>
                    <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.commandStateText}>No configured models available.</Text>
                  </View>
                ) : (
                  modelProviderGroups.map(([providerId, providerName]) => {
                    const providerModels = providerOptions.filter(
                      (option) => option.providerId === providerId,
                    );
                    return (
                      <View key={providerId} style={styles.pickerGroup}>
                        <Text style={styles.pickerGroupLabel}>{providerName}</Text>
                        {providerModels.map((option) => {
                          const isSelected =
                            runtimeControls?.model?.providerID === option.providerId &&
                            runtimeControls?.model?.modelID === option.modelId;
                          return (
                            <TouchableOpacity
                              key={`${option.providerId}:${option.modelId}`}
                              style={styles.pickerItem}
                              onPress={() => applyModelSelection(option.providerId, option.modelId)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.pickerItemTextWrap}>
                                <Text style={styles.pickerItemLabel}>{option.modelName}</Text>
                                <Text style={styles.pickerItemDescription}>{option.providerId}</Text>
                              </View>
                              {isSelected ? (
                                <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={variantModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setVariantModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.variantModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Variant</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setVariantModalVisible(false)}
                >
                  <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.variantBody}>
                <Text style={styles.variantHint}>
                  Set a temporary variant for this session. Leave empty to use the default.
                </Text>
                <TextInput
                  style={styles.variantInput}
                  value={variantDraft}
                  onChangeText={setVariantDraft}
                  placeholder="default"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    const value = variantDraft.trim();
                    applyVariantSelection(value.length > 0 ? value : null);
                  }}
                />

                <View style={styles.variantActions}>
                  <TouchableOpacity
                    style={[styles.variantButton, styles.variantButtonSecondary]}
                    onPress={() => {
                      setVariantDraft('');
                      applyVariantSelection(null);
                    }}
                  >
                    <Text style={styles.variantButtonSecondaryText}>Clear</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.variantButton, styles.variantButtonPrimary]}
                    onPress={() => {
                      const value = variantDraft.trim();
                      applyVariantSelection(value.length > 0 ? value : null);
                    }}
                  >
                    <Text style={styles.variantButtonPrimaryText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

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
  runtimeControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.surface,
  },
  runtimeChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  runtimeChipLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 1,
  },
  runtimeChipValue: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  pickerModalCard: {
    maxHeight: '75%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  pickerGroup: {
    marginBottom: SPACING.sm,
  },
  pickerGroupLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
    marginTop: 4,
  },
  pickerItem: {
    minHeight: 44,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  pickerItemTextWrap: {
    flex: 1,
  },
  pickerItemLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  pickerItemDescription: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  variantModalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  variantBody: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  variantHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  variantInput: {
    minHeight: 44,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    color: COLORS.text,
    paddingHorizontal: SPACING.sm,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: FONT_SIZE.md,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  variantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  variantButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  variantButtonSecondary: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
  },
  variantButtonPrimary: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  variantButtonSecondaryText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  variantButtonPrimaryText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.white,
    fontWeight: '700',
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
