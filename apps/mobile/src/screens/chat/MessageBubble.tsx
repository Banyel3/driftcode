/**
 * MessageBubble
 *
 * Renders a single chat message.  User messages are right-aligned bubbles;
 * assistant messages are left-aligned with support for all part types.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Message, MessagePart, ToolInvocationPart } from '@driftcode/opencode-client';
import {
  COLORS,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
} from '../../constants';
import { MarkdownText } from './MarkdownText';
import { ToolCallCard } from './ToolCallCard';
import { ReasoningBlock } from './ReasoningBlock';

interface MessageBubbleProps {
  message: Message;
}

// ---------------------------------------------------------------------------
// Part renderer
// ---------------------------------------------------------------------------
function renderPart(
  part: MessagePart,
  index: number,
  isUser: boolean,
  messageId: string,
): React.ReactNode {
  switch (part.type) {
    case 'text':
      if (!part.text) return null;
      return (
        <MarkdownText
          key={`${messageId}-text-${index}`}
          color={isUser ? COLORS.white : COLORS.text}
        >
          {part.text}
        </MarkdownText>
      );

    case 'tool-invocation':
      return (
        <ToolCallCard
          key={`${messageId}-tool-${(part as ToolInvocationPart).toolInvocation.toolCallId}-${(part as ToolInvocationPart).toolInvocation.state}-${index}`}
          toolInvocation={part.toolInvocation}
        />
      );

    case 'reasoning':
      return (
        <ReasoningBlock
          key={`${messageId}-reasoning-${index}`}
          reasoning={part.reasoning}
        />
      );

    case 'step-start':
      return (
        <View key={`${messageId}-step-${index}`} style={styles.stepSeparator}>
          <View style={styles.stepLine} />
        </View>
      );

    case 'file':
      return (
        <View key={`${messageId}-file-${index}`} style={styles.filePart}>
          <Text style={styles.fileLabel}>
            Attached file ({part.mimeType})
          </Text>
        </View>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function MessageBubble({ message }: MessageBubbleProps): React.ReactElement {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {/* Avatar dot for assistant */}
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        {message.parts.map((part, idx) => renderPart(part, idx, isUser, message.id))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Streaming indicator — animated dots
// ---------------------------------------------------------------------------
export function TypingIndicator(): React.ReactElement {
  return (
    <View style={[styles.row, styles.rowAssistant]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>AI</Text>
      </View>
      <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
        <Text style={styles.typingLabel}>AI is typing…</Text>
        <Text style={styles.typingDots}>{'• • •'}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    alignItems: 'flex-end',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.white,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  userBubble: {
    backgroundColor: COLORS.userBubble,
    borderBottomRightRadius: BORDER_RADIUS.sm,
  },
  assistantBubble: {
    backgroundColor: COLORS.aiBubble,
    borderBottomLeftRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typingBubble: {
    paddingVertical: SPACING.xs,
    gap: 2,
  },
  typingLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  typingDots: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  stepSeparator: {
    paddingVertical: SPACING.xs,
  },
  stepLine: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
  },
  filePart: {
    paddingVertical: 2,
  },
  fileLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});
