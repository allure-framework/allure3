import { type CiDescriptor, type CiGitHints, GitProvider } from "@allurereport/core-api";

import { getEnv } from "../utils.js";

export const resolveBitbucketGitHints = (ci: CiDescriptor): CiGitHints => {
  const repositorySlug = getEnv("BITBUCKET_REPO_FULL_NAME");
  const origin = getEnv("BITBUCKET_GIT_HTTP_ORIGIN");
  const repository = repositorySlug
    ? {
        slug: repositorySlug,
        url: origin || undefined,
      }
    : undefined;

  const sourceBranch = getEnv("BITBUCKET_BRANCH") || ci.jobRunBranch || undefined;
  const targetBranch = getEnv("BITBUCKET_PR_DESTINATION_BRANCH") || undefined;

  const prId = getEnv("BITBUCKET_PR_ID");
  const pullRequest = prId
    ? {
        id: prId,
        url: ci.pullRequestUrl || undefined,
        title: ci.pullRequestName || undefined,
      }
    : undefined;

  return {
    provider: GitProvider.Bitbucket,
    repository,
    sourceBranch,
    targetBranch,
    pullRequest,
  };
};
