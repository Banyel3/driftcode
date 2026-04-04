/**
 * MarkdownText
 *
 * A lightweight Markdown renderer built on React Native's <Text> component.
 * Handles the subset of Markdown most commonly produced by LLMs:
 *   - **bold** and *italic*
 *   - `inline code`
 *   - ```code blocks```
 *   - # headings (h1–h3)
 *   - Unordered lists (- or *)
 *   - Numbered lists (1. 2.)
 *   - Blank-line-separated paragraphs
 *
 * We intentionally avoid third-party Markdown libraries to keep the bundle
 * small and avoid native module issues with Expo Go.
 */
import React from 'react';
import { Text, View, StyleSheet, ScrollView } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants';

interface MarkdownTextProps {
  children: string;
  /** Override text colour (defaults to COLORS.text) */
  color?: string;
}

// ---------------------------------------------------------------------------
// Inline-span parser
// Converts a single line of text with **bold**, *italic*, `code` into an
// array of <Text> spans.
// ---------------------------------------------------------------------------
function parseInline(line: string, color: string, key: string): React.ReactNode {
  // Pattern: **bold**, *italic* (not **), `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    const [full, , bold, italic, code] = match;
    if (match.index > last) {
      nodes.push(
        <Text key={`${key}-t${last}`} style={{ color }}>
          {line.slice(last, match.index)}
        </Text>,
      );
    }
    if (bold !== undefined) {
      nodes.push(
        <Text key={`${key}-b${match.index}`} style={[{ color }, styles.bold]}>
          {bold}
        </Text>,
      );
    } else if (italic !== undefined) {
      nodes.push(
        <Text key={`${key}-i${match.index}`} style={[{ color }, styles.italic]}>
          {italic}
        </Text>,
      );
    } else if (code !== undefined) {
      nodes.push(
        <Text key={`${key}-c${match.index}`} style={styles.inlineCode}>
          {code}
        </Text>,
      );
    }
    last = match.index + full.length;
  }

  if (last < line.length) {
    nodes.push(
      <Text key={`${key}-t${last}`} style={{ color }}>
        {line.slice(last)}
      </Text>,
    );
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Block-level parser
// Splits the input into logical blocks (fenced code, heading, list item,
// paragraph) and renders each one.
// ---------------------------------------------------------------------------
export function MarkdownText({ children, color = COLORS.text }: MarkdownTextProps): React.ReactElement {
  const blocks: React.ReactNode[] = [];
  const lines = children.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // ── Fenced code block ────────────────────────────────────────────────
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      blocks.push(
        <ScrollView
          key={`code-${i}`}
          horizontal
          style={styles.codeBlock}
          showsHorizontalScrollIndicator={false}
        >
          <Text style={styles.codeText}>{codeLines.join('\n')}</Text>
        </ScrollView>,
      );
      i++; // consume closing ```
      continue;
    }

    // ── Headings ─────────────────────────────────────────────────────────
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = (headingMatch[1] ?? '').length;
      const text = headingMatch[2] ?? '';
      const headingStyle =
        level === 1
          ? styles.h1
          : level === 2
            ? styles.h2
            : styles.h3;
      blocks.push(
        <Text key={`h${level}-${i}`} style={[{ color }, headingStyle]}>
          {text}
        </Text>,
      );
      i++;
      continue;
    }

    // ── Unordered list item ───────────────────────────────────────────────
    const ulMatch = /^[-*]\s+(.+)$/.exec(line);
    if (ulMatch) {
      const text = ulMatch[1] ?? '';
      blocks.push(
        <View key={`ul-${i}`} style={styles.listItem}>
          <Text style={[styles.bullet, { color }]}>{'\u2022'}</Text>
          <Text style={[styles.listText, { color }]}>
            {parseInline(text, color, `ul-${i}`)}
          </Text>
        </View>,
      );
      i++;
      continue;
    }

    // ── Ordered list item ─────────────────────────────────────────────────
    const olMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (olMatch) {
      const num = olMatch[1] ?? '';
      const text = olMatch[2] ?? '';
      blocks.push(
        <View key={`ol-${i}`} style={styles.listItem}>
          <Text style={[styles.bullet, { color }]}>{num}.</Text>
          <Text style={[styles.listText, { color }]}>
            {parseInline(text, color, `ol-${i}`)}
          </Text>
        </View>,
      );
      i++;
      continue;
    }

    // ── Blank line → paragraph separator ─────────────────────────────────
    if (line.trim() === '') {
      blocks.push(<View key={`sep-${i}`} style={styles.paragraphSep} />);
      i++;
      continue;
    }

    // ── Normal paragraph line ─────────────────────────────────────────────
    blocks.push(
      <Text key={`p-${i}`} style={[styles.paragraph, { color }]}>
        {parseInline(line, color, `p-${i}`)}
      </Text>,
    );
    i++;
  }

  return <View>{blocks}</View>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  paragraph: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  paragraphSep: {
    height: SPACING.xs,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: 'Courier',
    fontSize: FONT_SIZE.xs,
    backgroundColor: COLORS.codeBg,
    color: COLORS.info,
    paddingHorizontal: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  codeBlock: {
    backgroundColor: COLORS.codeBg,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  codeText: {
    fontFamily: 'Courier',
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    lineHeight: 18,
  },
  h1: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  h2: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  h3: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bullet: {
    fontSize: FONT_SIZE.sm,
    marginRight: SPACING.xs,
    lineHeight: 20,
    minWidth: 14,
  },
  listText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
});
