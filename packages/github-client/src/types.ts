// ---------------------------------------------------------------------------
// GitHub API types used throughout the DriftCode mobile app.
// Snake_case fields from the GitHub REST API are mapped to camelCase here.
// ---------------------------------------------------------------------------

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  email: string | null;
  bio: string | null;
  publicRepos: number;
}

export interface GitHubRepoOwner {
  login: string;
  avatarUrl: string;
  type: 'User' | 'Organization';
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  owner: GitHubRepoOwner;
  stargazersCount: number;
  forksCount: number;
  updatedAt: string | null;
  pushedAt: string | null;
  language: string | null;
  topics: string[];
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
  commitSha: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  user: {
    login: string;
    avatarUrl: string;
  };
  headRefName: string;
  baseRefName: string;
}

export interface GitHubClientConfig {
  token: string;
}

export interface ListReposOptions {
  page?: number;
  perPage?: number;
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
  type?: 'all' | 'owner' | 'public' | 'private' | 'member';
}
