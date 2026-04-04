/**
 * useGitHubRepos
 *
 * Fetches the authenticated user's GitHub repos (GET /user/repos) and
 * provides in-memory search filtering.
 *
 * When `searchQuery` is 3+ characters we switch to the GitHub search API
 * (GET /search/repositories) so results span all public repos, not just the
 * user's own.  For shorter queries we filter the local list in memory.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  listUserRepos,
  searchRepos,
  createGitHubClient,
} from '@driftcode/github-client';
import type { GitHubRepo } from '@driftcode/github-client';
import { useConnectionStore } from '../store';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const githubRepoKeys = {
  list: ['githubRepos', 'list'] as const,
  search: (q: string) => ['githubRepos', 'search', q] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export interface UseGitHubReposResult {
  repos: GitHubRepo[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

export function useGitHubRepos(searchQuery: string): UseGitHubReposResult {
  const githubToken = useConnectionStore((s) => s.githubToken);
  const trimmed = searchQuery.trim();
  const isSearchMode = trimmed.length >= 3;

  // ── 1. Full list (always cached on first load) ───────────────────────────
  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
    error: listErr,
    isFetching: listFetching,
    refetch: listRefetch,
  } = useQuery<GitHubRepo[], Error>({
    queryKey: githubRepoKeys.list,
    enabled: githubToken !== null && !isSearchMode,
    queryFn: async () => {
      if (!githubToken) return [];
      const client = createGitHubClient({ token: githubToken });
      return listUserRepos(client, { perPage: 100, sort: 'updated' });
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // ── 2. Search results (only when query is long enough) ──────────────────
  const {
    data: searchData,
    isLoading: searchLoading,
    isError: searchError,
    error: searchErr,
    isFetching: searchFetching,
    refetch: searchRefetch,
  } = useQuery<GitHubRepo[], Error>({
    queryKey: githubRepoKeys.search(trimmed),
    enabled: githubToken !== null && isSearchMode,
    queryFn: async () => {
      if (!githubToken) return [];
      const client = createGitHubClient({ token: githubToken });
      // Scope to user's own repos for privacy + relevance.
      const userQuery = `${trimmed} user:${(await import('@driftcode/github-client').then((m) =>
        m.getAuthenticatedUser(client)
      )).login}`;
      return searchRepos(client, userQuery, 1, 30);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // ── 3. In-memory filter for short queries ────────────────────────────────
  const filteredList = useMemo(() => {
    const base = listData ?? [];
    if (!trimmed || isSearchMode) return base;
    const q = trimmed.toLowerCase();
    return base.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    );
  }, [listData, trimmed, isSearchMode]);

  const repos = isSearchMode ? (searchData ?? []) : filteredList;
  const isLoading = isSearchMode ? searchLoading : listLoading;
  const isError = isSearchMode ? searchError : listError;
  const error = isSearchMode ? searchErr : listErr;
  const isFetching = isSearchMode ? searchFetching : listFetching;
  const refetch = isSearchMode ? searchRefetch : listRefetch;

  return {
    repos,
    isLoading,
    isError,
    error: error ?? null,
    refresh: async () => { await refetch(); },
    isRefreshing: isFetching && !isLoading,
  };
}
