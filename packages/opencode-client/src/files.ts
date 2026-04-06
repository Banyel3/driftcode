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
  return client.get<FileContentResponse>(`/file/content?path=${encodedPath}`);
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
