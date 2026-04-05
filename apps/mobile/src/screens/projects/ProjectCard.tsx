/**
 * ProjectCard
 *
 * Displays a server-side project (a directory on the opencode server).
 * Shows the project name, full path, and an "Open" button that creates a
 * new session rooted at that project's directory.
 */
import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Project } from '@driftcode/opencode-client';
import {
  COLORS,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
  MIN_TOUCH_TARGET,
} from '../../constants';
import { basenameSafe, shortPathSafe } from '../../utils/path';
import { getProjectWorktree } from '../../utils/projectContext';

interface ProjectCardProps {
  project: Project;
  onOpen: (project: Project) => void;
}

/** Extract the last segment of a path as a display name. */
function projectDisplayName(project: Project): string {
  if (project.name?.trim()) return project.name.trim();
  const worktree = getProjectWorktree(project) ?? 'Unknown project';
  return basenameSafe(worktree) || worktree;
}

/** Shorten the path for display. */
function shortPath(path: string): string {
  return shortPathSafe(path, 3) ?? path;
}

export const ProjectCard = memo(function ProjectCard({
  project,
  onOpen,
}: ProjectCardProps) {
  const name = projectDisplayName(project);
  const path = shortPath(getProjectWorktree(project) ?? 'Unknown path');

  return (
    <View style={styles.card}>
      {/* Icon + text */}
      <View style={styles.iconWrap}>
        <Ionicons name="folder-open-outline" size={22} color={COLORS.warning} />
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.path} numberOfLines={1}>
          {path}
        </Text>
      </View>

      {/* Open button */}
      <TouchableOpacity
        style={styles.openBtn}
        onPress={() => onOpen(project)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="play-outline" size={14} color={COLORS.primary} />
        <Text style={styles.openBtnText}>Open</Text>
      </TouchableOpacity>
    </View>
  );
});

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
  },
  iconWrap: {
    width: 36,
    alignItems: 'center',
    flexShrink: 0,
    marginRight: SPACING.sm,
  },
  body: {
    flex: 1,
    gap: 3,
    marginRight: SPACING.sm,
  },
  name: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  path: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontFamily: 'Courier',
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexShrink: 0,
  },
  openBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
