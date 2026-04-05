import { useQuery } from '@tanstack/react-query';
import { createGitHubClient, listBranches } from '@driftcode/github-client';
import type { GitHubBranch } from '@driftcode/github-client';
import { useConnectionStore } from '../store';

export const githubBranchKeys = {
  all: (owner: string, repo: string) => ['githubBranches', owner, repo] as const,
};

export function useBranches(owner: string | null, repo: string | null) {
  const githubToken = useConnectionStore((s) => s.githubToken);

  const query = useQuery<GitHubBranch[], Error>({
    queryKey: githubBranchKeys.all(owner ?? '', repo ?? ''),
    enabled: githubToken !== null && owner !== null && repo !== null,
    queryFn: async () => {
      if (!githubToken || !owner || !repo) return [];
      const client = createGitHubClient({ token: githubToken });
      return listBranches(client, owner, repo);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    branches: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refresh: async () => {
      await query.refetch();
    },
    isRefreshing: query.isFetching && !query.isLoading,
  };
}
