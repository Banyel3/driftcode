import { Octokit } from '@octokit/rest';
import type { GitHubClientConfig } from './types';

export class GitHubClient {
  private readonly octokit: Octokit;

  constructor(config: GitHubClientConfig) {
    this.octokit = new Octokit({
      auth: config.token,
    });
  }

  /** Direct access to the underlying Octokit instance when needed. */
  getOctokit(): Octokit {
    return this.octokit;
  }
}

export function createGitHubClient(config: GitHubClientConfig): GitHubClient {
  return new GitHubClient(config);
}
