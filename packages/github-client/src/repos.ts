import type { GitHubClient } from './client';
import type { GitHubRepo, GitHubRepoOwner, GitHubUser, ListReposOptions } from './types';

// ---------------------------------------------------------------------------
// Mapping helpers — raw GitHub REST API → camelCase domain types
// ---------------------------------------------------------------------------

interface RawRepoOwner {
  login: string;
  avatar_url: string;
  type: string;
}

interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  owner: RawRepoOwner;
  stargazers_count: number;
  forks_count: number;
  updated_at: string | null;
  pushed_at: string | null;
  language: string | null;
  topics?: string[];
}

function mapOwner(raw: RawRepoOwner): GitHubRepoOwner {
  return {
    login: raw.login,
    avatarUrl: raw.avatar_url,
    type: (raw.type === 'Organization' ? 'Organization' : 'User') as
      | 'User'
      | 'Organization',
  };
}

function mapRepo(raw: RawRepo): GitHubRepo {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name,
    description: raw.description,
    private: raw.private,
    htmlUrl: raw.html_url,
    cloneUrl: raw.clone_url,
    sshUrl: raw.ssh_url,
    defaultBranch: raw.default_branch,
    owner: mapOwner(raw.owner),
    stargazersCount: raw.stargazers_count,
    forksCount: raw.forks_count,
    updatedAt: raw.updated_at,
    pushedAt: raw.pushed_at,
    language: raw.language,
    topics: raw.topics ?? [],
  };
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * GET /user/repos — lists repos for the authenticated user.
 */
export async function listUserRepos(
  client: GitHubClient,
  options: ListReposOptions = {},
): Promise<GitHubRepo[]> {
  const { data } = await client
    .getOctokit()
    .rest.repos.listForAuthenticatedUser({
      sort: options.sort ?? 'updated',
      direction: options.direction ?? 'desc',
      type: options.type ?? 'all',
      per_page: options.perPage ?? 30,
      page: options.page ?? 1,
    });

  return (data as RawRepo[]).map(mapRepo);
}

/**
 * GET /search/repositories — fuzzy-searches repos.
 */
export async function searchRepos(
  client: GitHubClient,
  query: string,
  page = 1,
  perPage = 20,
): Promise<GitHubRepo[]> {
  const { data } = await client.getOctokit().rest.search.repos({
    q: query,
    per_page: perPage,
    page,
  });

  return (data.items as RawRepo[]).map(mapRepo);
}

/**
 * GET /orgs/{org}/repos — lists repos for an organization.
 */
export async function listOrgRepos(
  client: GitHubClient,
  org: string,
  options: ListReposOptions = {},
): Promise<GitHubRepo[]> {
  const { data } = await client.getOctokit().rest.repos.listForOrg({
    org,
    sort: options.sort ?? 'updated',
    per_page: options.perPage ?? 30,
    page: options.page ?? 1,
  });

  return (data as RawRepo[]).map(mapRepo);
}

/**
 * GET /user — returns the authenticated user's profile.
 */
export async function getAuthenticatedUser(
  client: GitHubClient,
): Promise<GitHubUser> {
  const { data } = await client
    .getOctokit()
    .rest.users.getAuthenticated();

  return {
    login: data.login,
    name: data.name ?? null,
    avatarUrl: data.avatar_url,
    email: data.email ?? null,
    bio: data.bio ?? null,
    publicRepos: data.public_repos,
  };
}
