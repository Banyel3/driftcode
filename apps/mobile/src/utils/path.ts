/**
 * Safe path utilities
 *
 * All functions accept `unknown` so callers never crash when the server
 * returns null / undefined / non-string values for path fields.
 */

/**
 * Normalise `value` to a non-empty string path, or return null.
 * Converts Windows back-slashes to forward slashes.
 */
export function asPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return value.replace(/\\/g, '/');
}

/**
 * Return the last path segment (filename / directory name) for display.
 * Falls back to the full string, or an empty string if value is not a path.
 */
export function basenameSafe(value: unknown): string {
  const p = asPath(value);
  if (p === null) return '';
  return p.split('/').filter(Boolean).at(-1) ?? p;
}

/**
 * Return a shortened display path (last `segments` parts, prefixed with "…/").
 * Returns null when the value is not a usable path.
 *
 * @param value    Raw value from API (may be null/undefined/non-string)
 * @param segments How many tail segments to show (default 2)
 */
export function shortPathSafe(value: unknown, segments = 2): string | null {
  const p = asPath(value);
  if (p === null) return null;
  const parts = p.split('/').filter(Boolean);
  if (parts.length <= segments) return p;
  return `…/${parts.slice(-segments).join('/')}`;
}
