// ─── Design tokens — match the PRD colour palette ────────────────────────────
export const COLORS = {
  // Brand
  primary: '#0066CC',
  primaryLight: '#338FE6',
  primaryDark: '#004C99',

  // Backgrounds — GitHub dark palette
  background: '#0D1117',
  surface: '#161B22',
  surfaceElevated: '#21262D',
  surfaceHover: '#30363D',

  // Text
  text: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#6E7681',

  // Borders
  border: '#30363D',
  borderSubtle: '#21262D',

  // Semantic
  success: '#3FB950',
  warning: '#D29922',
  error: '#F85149',
  info: '#58A6FF',

  // Chat bubbles
  userBubble: '#0066CC',
  aiBubble: '#161B22',

  // Code blocks
  codeBg: '#0D1117',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof COLORS;
