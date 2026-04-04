/**
 * SyntaxText
 *
 * A lightweight token-based syntax highlighter built on React Native's
 * <Text> component.  No native modules, no WebView, no network requests.
 *
 * Supported token types: keywords, strings, comments, numbers, operators.
 * Language is inferred from the file extension.
 *
 * For unknown / binary files the content is rendered as plain monospaced text.
 */
import React, { memo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE } from '../../constants';

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------
type Lang =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'json'
  | 'css'
  | 'html'
  | 'shell'
  | 'plain';

export function detectLang(filePath: string): Lang {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const MAP: Record<string, Lang> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    json: 'json',
    css: 'css', scss: 'css',
    html: 'html', htm: 'html',
    sh: 'shell', bash: 'shell', zsh: 'shell',
  };
  return MAP[ext] ?? 'plain';
}

// ---------------------------------------------------------------------------
// Token colours
// ---------------------------------------------------------------------------
const T = {
  keyword:  '#cc99cd',
  string:   '#7ec699',
  comment:  '#999999',
  number:   '#f08d49',
  operator: '#67cdcc',
  type:     '#e8bf6a',
  plain:    COLORS.text,
} as const;

// ---------------------------------------------------------------------------
// Per-language token rules
// Rules are tested in order — first match wins for each character position.
// ---------------------------------------------------------------------------
interface TokenRule {
  pattern: RegExp;
  color: string;
}

const JS_KEYWORDS = /\b(const|let|var|function|class|return|if|else|for|while|do|switch|case|break|continue|import|export|default|from|new|typeof|instanceof|void|null|undefined|true|false|async|await|try|catch|finally|throw|extends|implements|interface|type|enum|namespace|module|declare|abstract|override|static|public|private|protected|readonly|keyof|infer|is|as|in|of)\b/;
const PY_KEYWORDS  = /\b(def|class|return|if|elif|else|for|while|import|from|as|pass|break|continue|try|except|finally|raise|with|yield|lambda|not|and|or|in|is|None|True|False|global|nonlocal|del|assert|async|await)\b/;
const RS_KEYWORDS  = /\b(fn|let|mut|const|struct|enum|impl|trait|use|mod|pub|crate|super|self|if|else|match|for|while|loop|return|break|continue|where|type|async|await|move|ref|dyn|box|unsafe|extern)\b/;
const GO_KEYWORDS  = /\b(func|var|const|type|struct|interface|package|import|return|if|else|for|range|switch|case|default|break|continue|go|defer|select|chan|map|nil|true|false)\b/;

function rulesForLang(lang: Lang): TokenRule[] {
  const jsLike: TokenRule[] = [
    { pattern: /\/\/.*$/,                     color: T.comment  },
    { pattern: /\/\*[\s\S]*?\*\//,            color: T.comment  },
    { pattern: /(["'`])(?:\\.|(?!\1)[^\\])*\1/,color: T.string  },
    { pattern: JS_KEYWORDS,                   color: T.keyword  },
    { pattern: /\b[A-Z][A-Za-z0-9_]*\b/,     color: T.type     },
    { pattern: /\b\d+(\.\d+)?\b/,            color: T.number   },
    { pattern: /[+\-*/%=<>!&|^~?:]+/,        color: T.operator },
  ];

  switch (lang) {
    case 'typescript':
    case 'javascript':
      return jsLike;

    case 'python':
      return [
        { pattern: /#.*$/,                          color: T.comment  },
        { pattern: /("""[\s\S]*?"""|'''[\s\S]*?''')/,color: T.string  },
        { pattern: /(["'])(?:\\.|(?!\1)[^\\])*\1/,  color: T.string  },
        { pattern: PY_KEYWORDS,                     color: T.keyword  },
        { pattern: /\b[A-Z][A-Za-z0-9_]*\b/,       color: T.type     },
        { pattern: /\b\d+(\.\d+)?\b/,              color: T.number   },
        { pattern: /[+\-*/%=<>!&|^~?:]+/,          color: T.operator },
      ];

    case 'rust':
      return [
        { pattern: /\/\/.*$/,                     color: T.comment  },
        { pattern: /\/\*[\s\S]*?\*\//,            color: T.comment  },
        { pattern: /(["'])(?:\\.|(?!\1)[^\\])*\1/,color: T.string  },
        { pattern: RS_KEYWORDS,                   color: T.keyword  },
        { pattern: /\b[A-Z][A-Za-z0-9_]*\b/,     color: T.type     },
        { pattern: /\b\d+(\.\d+)?\b/,            color: T.number   },
        { pattern: /[+\-*/%=<>!&|^~?:]+/,        color: T.operator },
      ];

    case 'go':
      return [
        { pattern: /\/\/.*$/,                     color: T.comment  },
        { pattern: /\/\*[\s\S]*?\*\//,            color: T.comment  },
        { pattern: /(["'`])(?:\\.|(?!\1)[^\\])*\1/,color: T.string  },
        { pattern: GO_KEYWORDS,                   color: T.keyword  },
        { pattern: /\b[A-Z][A-Za-z0-9_]*\b/,     color: T.type     },
        { pattern: /\b\d+(\.\d+)?\b/,            color: T.number   },
        { pattern: /[+\-*/%=<>!&|^~?:]+/,        color: T.operator },
      ];

    case 'json':
      return [
        { pattern: /"(?:[^"\\]|\\.)*"\s*:/,       color: T.type     },
        { pattern: /"(?:[^"\\]|\\.)*"/,           color: T.string   },
        { pattern: /\b(true|false|null)\b/,       color: T.keyword  },
        { pattern: /\b\d+(\.\d+)?\b/,            color: T.number   },
      ];

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Tokeniser
// Splits one line of source into an array of { text, color } spans.
// ---------------------------------------------------------------------------
interface Span {
  text: string;
  color: string;
}

function tokeniseLine(line: string, rules: TokenRule[]): Span[] {
  if (rules.length === 0) return [{ text: line, color: T.plain }];

  const spans: Span[] = [];
  let remaining = line;
  let safetyLimit = 2000; // prevent infinite loop on pathological input

  while (remaining.length > 0 && safetyLimit-- > 0) {
    let earliest: { index: number; length: number; color: string } | null = null;

    for (const rule of rules) {
      const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes('m') ? rule.pattern.flags : rule.pattern.flags + 'm');
      const m = re.exec(remaining);
      if (m && (earliest === null || m.index < earliest.index)) {
        earliest = { index: m.index, length: m[0].length, color: rule.color };
      }
    }

    if (!earliest) {
      spans.push({ text: remaining, color: T.plain });
      break;
    }

    if (earliest.index > 0) {
      spans.push({ text: remaining.slice(0, earliest.index), color: T.plain });
    }
    spans.push({
      text: remaining.slice(earliest.index, earliest.index + earliest.length),
      color: earliest.color,
    });
    remaining = remaining.slice(earliest.index + earliest.length);
  }

  return spans;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface SyntaxTextProps {
  content: string;
  lang: Lang;
  /** Optional: cap how many lines we render (performance guard). */
  maxLines?: number;
}

export const SyntaxText = memo(function SyntaxText({
  content,
  lang,
  maxLines = 2000,
}: SyntaxTextProps): React.ReactElement {
  const rules = rulesForLang(lang);
  const lines = content.split('\n');
  const visibleLines = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;

  return (
    <View>
      {visibleLines.map((line, lineIdx) => {
        const spans = tokeniseLine(line, rules);
        return (
          <Text key={lineIdx} style={styles.line}>
            <Text style={styles.lineNo}>
              {String(lineIdx + 1).padStart(4, ' ')}{' '}
            </Text>
            {spans.map((span, spanIdx) => (
              <Text key={spanIdx} style={{ color: span.color }}>
                {span.text}
              </Text>
            ))}
          </Text>
        );
      })}
      {truncated && (
        <Text style={styles.truncated}>
          … {lines.length - maxLines} more lines (truncated for performance)
        </Text>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  line: {
    fontFamily: 'Courier',
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
    color: COLORS.text,
  },
  lineNo: {
    color: COLORS.textMuted,
    userSelect: 'none',
  },
  truncated: {
    fontFamily: 'Courier',
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
