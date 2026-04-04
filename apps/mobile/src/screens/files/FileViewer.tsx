/**
 * FileViewer
 *
 * Shows the content of a single file:
 *   - Language-aware syntax highlighting via SyntaxText
 *   - Horizontally scrollable (for long lines)
 *   - Vertically scrollable
 *   - "Ask AI" action bar at the bottom with quick actions:
 *       Explain | Refactor | Fix  + a free-form "Ask…" button
 *
 * All "Ask AI" actions navigate to the Chat tab with a pre-built message.
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants';
import { useFileContent } from '../../hooks/useFileContent';
import { basenameSafe } from '../../utils/path';
import { detectLang, SyntaxText } from './SyntaxText';

// ---------------------------------------------------------------------------
// Quick-action button
// ---------------------------------------------------------------------------
interface ActionBtn {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  buildMessage: (filePath: string) => string;
}

const ACTIONS: ActionBtn[] = [
  {
    label: 'Explain',
    icon: 'information-circle-outline',
    buildMessage: (p) => `Please explain what \`${p}\` does.`,
  },
  {
    label: 'Refactor',
    icon: 'construct-outline',
    buildMessage: (p) => `Please suggest refactoring improvements for \`${p}\`.`,
  },
  {
    label: 'Fix',
    icon: 'bug-outline',
    buildMessage: (p) =>
      `Please review \`${p}\` for bugs or issues and suggest fixes.`,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface FileViewerProps {
  filePath: string;
  onAskAI: (message: string, filePath: string) => void;
  onClose?: () => void;
}

export function FileViewer({
  filePath,
  onAskAI,
  onClose,
}: FileViewerProps): React.ReactElement {
  const { content, isLoading, isError, error, refresh } = useFileContent(filePath);
  const lang = detectLang(filePath);

  // Basename for the header
  const filename = basenameSafe(filePath) || filePath;

  const handleAction = useCallback(
    (action: ActionBtn) => {
      onAskAI(action.buildMessage(filePath), filePath);
    },
    [filePath, onAskAI],
  );

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {onClose && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.headerText}>
          <Text style={styles.filename} numberOfLines={1}>
            {filename}
          </Text>
          <Text style={styles.langBadge}>{lang}</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={refresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="refresh-outline" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <ScrollView style={styles.codeScroll} showsVerticalScrollIndicator>
        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.codeHorizScroll}>
          {isLoading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading file…</Text>
            </View>
          )}
          {isError && (
            <View style={styles.center}>
              <Ionicons name="warning-outline" size={32} color={COLORS.error} />
              <Text style={styles.errorText}>
                {error?.message ?? 'Could not load file.'}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {!isLoading && !isError && content !== null && (
            <View style={styles.codeInner}>
              <SyntaxText content={content} lang={lang} />
            </View>
          )}
          {!isLoading && !isError && content === null && (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Empty file.</Text>
            </View>
          )}
        </ScrollView>
      </ScrollView>

      {/* ── AI action bar ──────────────────────────────────────────────── */}
      <View style={styles.actionBar}>
        {ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.actionBtn}
            onPress={() => handleAction(action)}
          >
            <Ionicons name={action.icon} size={14} color={COLORS.primary} />
            <Text style={styles.actionBtnText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.actionBtn, styles.askBtn]}
          onPress={() => onAskAI(`Let's look at \`${filePath}\`. `, filePath)}
        >
          <Ionicons name="sparkles-outline" size={14} color={COLORS.white} />
          <Text style={styles.askBtnText}>Ask AI</Text>
        </TouchableOpacity>
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
    backgroundColor: COLORS.codeBg,
  },
  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  backBtn: {
    padding: 4,
  },
  headerText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  filename: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'Courier',
  },
  langBadge: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    flexShrink: 0,
  },
  refreshBtn: {
    padding: 4,
  },
  // ── Code area ──────────────────────────────────────────────────────────
  codeScroll: {
    flex: 1,
  },
  codeHorizScroll: {
    flex: 1,
  },
  codeInner: {
    padding: SPACING.sm,
    minWidth: '100%',
  },
  // ── States ─────────────────────────────────────────────────────────────
  center: {
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
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
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  // ── Action bar ──────────────────────────────────────────────────────────
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  askBtn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    marginLeft: 'auto',
  },
  askBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.white,
  },
});
