/**
 * FileTreeNode
 *
 * Renders a single entry in the file tree.
 *
 * - Files: tappable row — calls onSelectFile
 * - Directories: tappable row that expands/collapses; children are lazily
 *   loaded (via useFileTree) on first expand so we never over-fetch.
 *
 * depth controls the left-indent level (2 * SPACING.sm per level).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FileEntry } from '@driftcode/opencode-client';
import { COLORS, FONT_SIZE, SPACING } from '../../constants';
import { useFileTree } from '../../hooks/useFileTree';

// ---------------------------------------------------------------------------
// File-extension → icon map
// ---------------------------------------------------------------------------
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function fileIcon(name: string): { icon: IoniconName; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const MAP: Record<string, { icon: IoniconName; color: string }> = {
    ts:   { icon: 'code-slash-outline', color: '#3178c6' },
    tsx:  { icon: 'code-slash-outline', color: '#3178c6' },
    js:   { icon: 'code-slash-outline', color: '#f1e05a' },
    jsx:  { icon: 'code-slash-outline', color: '#f1e05a' },
    py:   { icon: 'code-slash-outline', color: '#3572A5' },
    rs:   { icon: 'code-slash-outline', color: '#dea584' },
    go:   { icon: 'code-slash-outline', color: '#00ADD8' },
    json: { icon: 'document-text-outline', color: '#COLORS.warning' },
    md:   { icon: 'document-text-outline', color: COLORS.textSecondary },
    txt:  { icon: 'document-text-outline', color: COLORS.textMuted },
    css:  { icon: 'color-palette-outline', color: '#563d7c' },
    html: { icon: 'globe-outline', color: '#e34c26' },
    svg:  { icon: 'image-outline', color: COLORS.success },
    png:  { icon: 'image-outline', color: COLORS.success },
    jpg:  { icon: 'image-outline', color: COLORS.success },
    jpeg: { icon: 'image-outline', color: COLORS.success },
    gif:  { icon: 'image-outline', color: COLORS.success },
    lock: { icon: 'lock-closed-outline', color: COLORS.textMuted },
    toml: { icon: 'settings-outline', color: COLORS.textMuted },
    yaml: { icon: 'settings-outline', color: COLORS.textMuted },
    yml:  { icon: 'settings-outline', color: COLORS.textMuted },
    env:  { icon: 'key-outline', color: COLORS.warning },
    sh:   { icon: 'terminal-outline', color: COLORS.success },
    bash: { icon: 'terminal-outline', color: COLORS.success },
  };
  return MAP[ext] ?? { icon: 'document-outline', color: COLORS.textMuted };
}

/** Last path segment (filename or directory name) */
function basename(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? path;
}

// ---------------------------------------------------------------------------
// Single node
// ---------------------------------------------------------------------------
interface FileTreeNodeProps {
  entry: FileEntry;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

export function FileTreeNode({
  entry,
  depth,
  selectedPath,
  onSelectFile,
}: FileTreeNodeProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const isDir = entry.type === 'directory';
  const name = basename(entry.path);
  const isSelected = entry.path === selectedPath;
  const indent = depth * SPACING.md;

  // Lazily load children only after first expansion.
  const { entries: children, isLoading: loadingChildren } = useFileTree(
    entry.path,
    isDir && expanded,
  );

  const handlePress = useCallback(() => {
    if (isDir) {
      setExpanded((v) => !v);
    } else {
      onSelectFile(entry.path);
    }
  }, [isDir, entry.path, onSelectFile]);

  const { icon, color: iconColor } = isDir
    ? { icon: (expanded ? 'folder-open-outline' : 'folder-outline') as IoniconName, color: COLORS.warning }
    : fileIcon(name);

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.row,
          { paddingLeft: SPACING.md + indent },
          isSelected && styles.rowSelected,
        ]}
        onPress={handlePress}
        activeOpacity={0.6}
      >
        {/* Directory chevron */}
        {isDir ? (
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={12}
            color={COLORS.textMuted}
            style={styles.chevron}
          />
        ) : (
          <View style={styles.chevronPlaceholder} />
        )}

        {/* File / folder icon */}
        <Ionicons name={icon} size={15} color={iconColor} style={styles.fileIcon} />

        {/* Name */}
        <Text
          style={[
            styles.name,
            isDir && styles.dirName,
            isSelected && styles.selectedName,
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>

        {/* Loading spinner for lazy dir load */}
        {isDir && expanded && loadingChildren && (
          <ActivityIndicator size="small" color={COLORS.textMuted} style={styles.spinner} />
        )}
      </TouchableOpacity>

      {/* Children */}
      {isDir && expanded && !loadingChildren && children.length > 0 && (
        <View>
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: SPACING.md,
    minHeight: 34,
  },
  rowSelected: {
    backgroundColor: COLORS.primary + '22',
  },
  chevron: {
    width: 14,
    flexShrink: 0,
  },
  chevronPlaceholder: {
    width: 14,
    flexShrink: 0,
  },
  fileIcon: {
    marginRight: 6,
    flexShrink: 0,
  },
  name: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
  },
  dirName: {
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  selectedName: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: SPACING.xs,
  },
});
