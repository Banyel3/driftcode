/**
 * RepoCard
 *
 * Displays a GitHub repository.
 *
 * Layout:
 *   [icon]  [name]  [private badge]            [language badge]
 *           [description]
 *           [⭐ stars]  [fork count]            [Open button]
 *
 * "Open" creates a new session and pre-fills the message with a
 * `git clone` instruction so the agent clones and opens the repo.
 */
import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GitHubRepo } from '@driftcode/github-client';
import {
  COLORS,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
  MIN_TOUCH_TARGET,
} from '../../constants';

// ---------------------------------------------------------------------------
// Language colour map (subset — mirrors GitHub's linguist palette)
// ---------------------------------------------------------------------------
const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  Ruby: '#701516',
  Shell: '#89e051',
  Dart: '#00B4AB',
  CSS: '#563d7c',
  HTML: '#e34c26',
};

function langColor(language: string | null): string {
  if (!language) return COLORS.textMuted;
  return LANG_COLORS[language] ?? COLORS.textMuted;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface RepoCardProps {
  repo: GitHubRepo;
  onOpen: (repo: GitHubRepo) => void;
}

export const RepoCard = memo(function RepoCard({
  repo,
  onOpen,
}: RepoCardProps) {
  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.topRow}>
        <Ionicons
          name="git-branch-outline"
          size={16}
          color={COLORS.textMuted}
          style={styles.repoIcon}
        />
        <Text style={styles.name} numberOfLines={1}>
          {repo.name}
        </Text>
        {repo.private && (
          <View style={styles.privateBadge}>
            <Ionicons name="lock-closed" size={9} color={COLORS.textMuted} />
            <Text style={styles.privateBadgeText}>Private</Text>
          </View>
        )}
        {/* Open button — top-right */}
        <TouchableOpacity
          style={styles.openBtn}
          onPress={() => onOpen(repo)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.openBtnText}>Open</Text>
          <Ionicons name="arrow-forward" size={12} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Description */}
      {!!repo.description && (
        <Text style={styles.description} numberOfLines={2}>
          {repo.description}
        </Text>
      )}

      {/* Bottom meta row */}
      <View style={styles.metaRow}>
        {repo.language && (
          <View style={styles.langRow}>
            <View
              style={[
                styles.langDot,
                { backgroundColor: langColor(repo.language) },
              ]}
            />
            <Text style={styles.metaText}>{repo.language}</Text>
          </View>
        )}
        {repo.stargazersCount > 0 && (
          <View style={styles.metaItem}>
            <Ionicons name="star-outline" size={11} color={COLORS.textMuted} />
            <Text style={styles.metaText}>
              {repo.stargazersCount >= 1000
                ? `${(repo.stargazersCount / 1000).toFixed(1)}k`
                : String(repo.stargazersCount)}
            </Text>
          </View>
        )}
        {repo.forksCount > 0 && (
          <View style={styles.metaItem}>
            <Ionicons
              name="git-network-outline"
              size={11}
              color={COLORS.textMuted}
            />
            <Text style={styles.metaText}>{repo.forksCount}</Text>
          </View>
        )}
        {repo.defaultBranch !== 'main' && repo.defaultBranch !== 'master' && (
          <View style={styles.metaItem}>
            <Ionicons
              name="git-branch-outline"
              size={11}
              color={COLORS.textMuted}
            />
            <Text style={styles.metaText}>{repo.defaultBranch}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    minHeight: MIN_TOUCH_TARGET,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  repoIcon: {
    flexShrink: 0,
  },
  name: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.info,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexShrink: 0,
  },
  privateBadgeText: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
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
  description: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginLeft: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginLeft: 22,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  langDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
