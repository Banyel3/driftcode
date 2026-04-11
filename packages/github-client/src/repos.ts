import type { GitHubClient } from './client';
import type {
  GitHubRepo,
  GitHubRepoOwner,
  GitHubUser,
  ListReposOptions,
  GitHubBranch,
  GitHubPullRequest,
} from './types';

function mapGitHubError(err: unknown): Error {
  if (!err || typeof err !== 'object') {
    return new Error('GitHub request failed.');
  }

  const e = err as {
    status?: number;
    message?: string;
    response?: {
      headers?: Record<string, string>;
      data?: { message?: string };
    };
  };

  const status = typeof e.status === 'number' ? e.status : null;
  const rawMessage =
    typeof e.response?.data?.message === 'string'
      ? e.response.data.message
      : typeof e.message === 'string'
        ? e.message
        : 'GitHub request failed.';

  if (status === 401) {
    return new Error('GitHub authentication failed. Reconnect your token in Settings.');
  }

  if (status === 403) {
    const remaining = e.response?.headers?.['x-ratelimit-remaining'];
    if (remaining === '0') {
      return new Error('GitHub rate limit exceeded. Try again later.');
    }
    return new Error('GitHub access forbidden. Check token scopes and repo access.');
  }

  if (status === 404) {
    return new Error('Repository not found or token does not have access.');
  }

  if (status !== null) {
    return new Error(`GitHub request failed (${status}): ${rawMessage}`);
  }

  return new Error(`GitHub request failed: ${rawMessage}`);
}

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

interface RawBranch {
  name: string;
  protected: boolean;
  commit: {
    sha: string;
  };
}

interface RawPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string;
  };
  base: {
    ref: string;
  };
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

function mapBranch(raw: RawBranch): GitHubBranch {
  return {
    name: raw.name,
    protected: raw.protected,
    commitSha: raw.commit.sha,
  };
}

function mapPullRequest(raw: RawPullRequest): GitHubPullRequest {
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    state: raw.state,
    htmlUrl: raw.html_url,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    user: {
      login: raw.user.login,
      avatarUrl: raw.user.avatar_url,
    },
    headRefName: raw.head.ref,
    baseRefName: raw.base.ref,
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

/**
 * GET /repos/{owner}/{repo}/branches — lists branches.
 */
export async function listBranches(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<GitHubBranch[]> {
  let data: unknown;
  try {
    ({ data } = await client.getOctokit().rest.repos.listBranches({
      owner,
      repo,
      per_page: 100,
      page: 1,
    }));
  } catch (err) {
    throw mapGitHubError(err);
  }

  return (data as RawBranch[]).map(mapBranch);
}

/**
 * GET /repos/{owner}/{repo}/pulls?state=open — lists open pull requests.
 */
export async function listPullRequests(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<GitHubPullRequest[]> {
  let data: unknown;
  try {
    ({ data } = await client.getOctokit().rest.pulls.list({
      owner,
      repo,
      state: 'open',
      per_page: 50,
      page: 1,
    }));
  } catch (err) {
    throw mapGitHubError(err);
  }

  return (data as RawPullRequest[]).map(mapPullRequest);
}
