/**
 * ReasoningBlock
 *
 * Displays an AI reasoning / thinking part in a collapsed-by-default
 * disclosure block.  Reasoning is shown verbatim (not Markdown-parsed)
 * since it's typically raw internal monologue.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants';

interface ReasoningBlockProps {
  reasoning: string;
}

export function ReasoningBlock({ reasoning }: ReasoningBlockProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="sparkles-outline"
          size={12}
          color={COLORS.warning}
        />
        <Text style={styles.label}>Thinking</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={COLORS.textMuted}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={styles.body} nestedScrollEnabled>
          <Text style={styles.text}>{reasoning}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
    borderRadius: BORDER_RADIUS.md,
    marginVertical: SPACING.xs,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: COLORS.warning + '11',
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.warning,
    fontStyle: 'italic',
  },
  chevron: {
    marginLeft: 'auto',
  },
  body: {
    maxHeight: 200,
    padding: SPACING.sm,
  },
  text: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
