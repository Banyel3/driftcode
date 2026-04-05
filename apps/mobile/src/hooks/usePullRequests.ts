import { useQuery } from '@tanstack/react-query';
import { createGitHubClient, listPullRequests } from '@driftcode/github-client';
import type { GitHubPullRequest } from '@driftcode/github-client';
import { useConnectionStore } from '../store';

export const githubPullRequestKeys = {
  all: (owner: string, repo: string) => ['githubPullRequests', owner, repo] as const,
};

export function usePullRequests(owner: string | null, repo: string | null) {
  const githubToken = useConnectionStore((s) => s.githubToken);

  const query = useQuery<GitHubPullRequest[], Error>({
    queryKey: githubPullRequestKeys.all(owner ?? '', repo ?? ''),
    enabled: githubToken !== null && owner !== null && repo !== null,
    queryFn: async () => {
      if (!githubToken || !owner || !repo) return [];
      const client = createGitHubClient({ token: githubToken });
      return listPullRequests(client, owner, repo);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    pullRequests: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refresh: async () => {
      await query.refetch();
    },
    isRefreshing: query.isFetching && !query.isLoading,
  };
}
