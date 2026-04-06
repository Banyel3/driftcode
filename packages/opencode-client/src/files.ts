import type { OpenCodeClient } from './client';
import type { FileEntry, FileContentResponse } from './types';

/**
 * GET /file?path=<path>
 * Returns the file tree for the given directory path.
 */
export async function listFiles(
  client: OpenCodeClient,
  path: string = '/',
): Promise<FileEntry[]> {
  const encodedPath = encodeURIComponent(path);
  return client.get<FileEntry[]>(`/file?path=${encodedPath}`);
}

/**
 * GET /file/content?path=<path>
 * Returns the raw string content of a single file.
 */
export async function getFileContent(
  client: OpenCodeClient,
  filePath: string,
): Promise<FileContentResponse> {
  const encodedPath = encodeURIComponent(filePath);
  const raw = await client.get<unknown>(`/file/content?path=${encodedPath}`);

  if (typeof raw === 'string') {
    return {
      type: 'text',
      content: raw,
    };
  }

  if (!raw || typeof raw !== 'object') {
    return {
      type: 'text',
      content: '',
    };
  }

  const payload = raw as Record<string, unknown>;
  const type = payload.type === 'binary' ? 'binary' : 'text';

  return {
    type,
    content: typeof payload.content === 'string' ? payload.content : '',
    ...(typeof payload.diff === 'string' ? { diff: payload.diff } : {}),
    ...(payload.patch !== undefined ? { patch: payload.patch } : {}),
    ...(typeof payload.mimeType === 'string' ? { mimeType: payload.mimeType } : {}),
    ...(typeof payload.encoding === 'string' ? { encoding: payload.encoding } : {}),
  };
}

/**
 * GET /find/file?query=<query>
 * Fuzzy-searches files by name/path on the server.
 */
export async function findFiles(
  client: OpenCodeClient,
  query: string,
): Promise<FileEntry[]> {
  const encodedQuery = encodeURIComponent(query);
  return client.get<FileEntry[]>(`/find/file?query=${encodedQuery}`);
}
