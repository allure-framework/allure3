import { type CiDescriptor, type CiGitHints, GitProvider } from "@allurereport/core-api";

import { resolveGithubPullRequestNumber } from "../helpers/github.js";
import { stripRefsHeads } from "../helpers/gitProvider.js";
import { getEnv } from "../utils.js";

export const resolveGithubGitHints = (ci: CiDescriptor): CiGitHints => {
  const repositorySlug = getEnv("GITHUB_REPOSITORY");
  const serverUrl = getEnv("GITHUB_SERVER_URL");
  const repository = repositorySlug
    ? {
        slug: repositorySlug,
        url: serverUrl ? `${serverUrl}/${repositorySlug}` : undefined,
      }
    : undefined;

  const headRef = getEnv("GITHUB_HEAD_REF");
  const baseRef = getEnv("GITHUB_BASE_REF");
  const sourceBranch = headRef || stripRefsHeads(getEnv("GITHUB_REF")) || ci.jobRunBranch || undefined;
  const targetBranch = baseRef || undefined;

  const pullRequestId = resolveGithubPullRequestNumber();

  const pullRequest = pullRequestId
    ? {
        id: pullRequestId,
        url: ci.pullRequestUrl || undefined,
        title: ci.pullRequestName || undefined,
      }
    : undefined;

  return {
    provider: GitProvider.Github,
    repository,
    sourceBranch,
    targetBranch,
    pullRequest,
  };
};
