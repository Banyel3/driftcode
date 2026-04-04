/**
 * SessionCard
 *
 * Displays a single session in the Sessions list.
 *
 * Layout:
 *   [icon]  [title / path]          [timestamp]
 *           [model badge]           [trash icon]
 *
 * The trash icon triggers a confirmation Alert before deleting.
 * The entire card (except the trash button) navigates to the Chat tab.
 */
import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@driftcode/opencode-client';
import {
  COLORS,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
  MIN_TOUCH_TARGET,
} from '../../constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Unix-millisecond timestamp as a human-readable relative string. */
function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/** Shorten a server-side filesystem path to a displayable string. */
function shortPath(path: string | null | undefined): string | null {
  if (!path) return null;
  // Keep only the last two path segments.
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join('/')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface SessionCardProps {
  session: Session;
  isActive: boolean;
  onPress: (session: Session) => void;
  onDelete: (sessionId: string) => void;
}

export const SessionCard = memo(function SessionCard({
  session,
  isActive,
  onPress,
  onDelete,
}: SessionCardProps) {
  const title = session.title?.trim() || 'Untitled session';
  const path = shortPath(session.path);

  const handleDelete = () => {
    Alert.alert(
      'Delete session',
      `"${title}" will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(session.id),
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive]}
      onPress={() => onPress(session)}
      activeOpacity={0.7}
    >
      {/* Left icon */}
      <View style={styles.iconWrap}>
        <Ionicons
          name={isActive ? 'chatbubble' : 'chatbubble-outline'}
          size={20}
          color={isActive ? COLORS.primary : COLORS.textMuted}
        />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.title, isActive && styles.titleActive]} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.meta}>
          {session.model && (
            <View style={styles.modelBadge}>
              <Text style={styles.modelText} numberOfLines={1}>
                {session.model}
              </Text>
            </View>
          )}
          {path && (
            <Text style={styles.path} numberOfLines={1}>
              {path}
            </Text>
          )}
        </View>
      </View>

      {/* Right — timestamp + delete */}
      <View style={styles.right}>
        <Text style={styles.timestamp}>{relativeTime(session.updatedAt)}</Text>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* Active indicator strip */}
      {isActive && <View style={styles.activeStrip} />}
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    minHeight: MIN_TOUCH_TARGET,
    position: 'relative',
  },
  cardActive: {
    backgroundColor: COLORS.surfaceElevated,
  },
  activeStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm,
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    marginRight: SPACING.sm,
    gap: 4,
  },
  title: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  titleActive: {
    color: COLORS.primary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  modelBadge: {
    backgroundColor: COLORS.surfaceHover,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
    maxWidth: 120,
  },
  modelText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  path: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    flex: 1,
    fontFamily: 'Courier',
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  timestamp: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
