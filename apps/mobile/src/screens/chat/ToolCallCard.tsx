/**
 * ToolCallCard
 *
 * Renders a single tool invocation part (call, partial-call, or result).
 * Shows the tool name, arguments as formatted JSON, and (when available)
 * the result.  The card is collapsible to save vertical space.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToolInvocation } from '@driftcode/opencode-client';
import {
  COLORS,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
} from '../../constants';

interface ToolCallCardProps {
  toolInvocation: ToolInvocation;
}

// Map known tool names to friendlier display labels.
function toolLabel(name: string): string {
  const MAP: Record<string, string> = {
    read_file: 'Read file',
    write_file: 'Write file',
    edit_file: 'Edit file',
    bash: 'Run command',
    list_files: 'List files',
    glob: 'Search files',
    grep: 'Search content',
    webfetch: 'Fetch URL',
    todo_read: 'Read todos',
    todo_write: 'Write todos',
  };
  return MAP[name] ?? name;
}

// Derive a headline argument for the tool (e.g. file path, command string).
function toolHeadline(toolInvocation: ToolInvocation): string | null {
  const { toolName, args } = toolInvocation;
  if (toolName === 'bash' && typeof args['command'] === 'string') {
    const cmd = args['command'] as string;
    return cmd.length > 60 ? cmd.slice(0, 60) + '…' : cmd;
  }
  if (
    (toolName === 'read_file' ||
      toolName === 'write_file' ||
      toolName === 'edit_file') &&
    typeof args['filePath'] === 'string'
  ) {
    return args['filePath'] as string;
  }
  if (toolName === 'glob' && typeof args['pattern'] === 'string') {
    return args['pattern'] as string;
  }
  if (toolName === 'grep' && typeof args['pattern'] === 'string') {
    return args['pattern'] as string;
  }
  if (toolName === 'webfetch' && typeof args['url'] === 'string') {
    return args['url'] as string;
  }
  return null;
}

function readableArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).filter(([key]) => !key.startsWith('__')),
  );
}

function getToolTitle(args: Record<string, unknown>): string | null {
  const raw = args.__title;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
}

function stateIcon(
  state: ToolInvocation['state'],
): { name: React.ComponentProps<typeof Ionicons>['name']; color: string } {
  if (state === 'result') return { name: 'checkmark-circle', color: COLORS.success };
  if (state === 'call') return { name: 'time-outline', color: COLORS.warning };
  return { name: 'ellipsis-horizontal-circle-outline', color: COLORS.textMuted };
}

export function ToolCallCard({ toolInvocation }: ToolCallCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const { name: iconName, color: iconColor } = stateIcon(toolInvocation.state);
  const headline = toolHeadline(toolInvocation);
  const argsPayload = readableArgs(toolInvocation.args);
  const argsJson = JSON.stringify(argsPayload, null, 2);
  const hasArgs = Object.keys(argsPayload).length > 0;
  const toolTitle = getToolTitle(toolInvocation.args);

  return (
    <View style={styles.card}>
      {/* Header row — always visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Ionicons name={iconName} size={14} color={iconColor} />
        <Text style={styles.toolName}>{toolLabel(toolInvocation.toolName)}</Text>
        {toolTitle !== null && (
          <Text style={styles.statusLabel} numberOfLines={1}>{toolTitle}</Text>
        )}
        {headline !== null && (
          <Text style={styles.headline} numberOfLines={1}>
            {headline}
          </Text>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={COLORS.textMuted}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.body}>
          {/* Args */}
          <Text style={styles.sectionLabel}>Arguments</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.json}>{hasArgs ? argsJson : 'No structured arguments'}</Text>
          </ScrollView>

          {/* Result (only when state === 'result') */}
          {toolInvocation.state === 'result' && (
            <>
              <Text style={[styles.sectionLabel, styles.resultLabel]}>Result</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.json} numberOfLines={20}>
                  {toolInvocation.result === undefined
                    ? 'No result payload'
                    : typeof toolInvocation.result === 'string'
                    ? toolInvocation.result
                    : JSON.stringify(toolInvocation.result, null, 2)}
                </Text>
              </ScrollView>
            </>
          )}

          {toolInvocation.state !== 'result' && (
            <Text style={styles.pendingText}>Running…</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.md,
    marginVertical: SPACING.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    gap: 6,
  },
  toolName: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.warning,
    fontWeight: '600',
  },
  headline: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontFamily: 'Courier',
  },
  chevron: {
    marginLeft: 'auto',
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.sm,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultLabel: {
    marginTop: SPACING.sm,
  },
  pendingText: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  json: {
    fontFamily: 'Courier',
    fontSize: FONT_SIZE.xs,
    color: COLORS.info,
    lineHeight: 16,
  },
});
