// Public API surface for @driftcode/github-client
//
// Architecture rule: ALL GitHub API calls in the mobile app MUST go through
// this package. Never import from @octokit/rest directly in components.

export type {
  GitHubUser,
  GitHubRepo,
  GitHubRepoOwner,
  GitHubClientConfig,
  ListReposOptions,
} from './types';

export { GitHubClient, createGitHubClient } from './client';

export {
  listUserRepos,
  searchRepos,
  listOrgRepos,
  getAuthenticatedUser,
} from './repos';
