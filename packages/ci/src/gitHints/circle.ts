import { type CiDescriptor, type CiGitHints } from "@allurereport/core-api";

import { parsePullRequestNumberFromUrl, resolveRepositoryFromGitUrl } from "../helpers/gitProvider.js";
import { getEnv } from "../utils.js";

export const resolveCircleGitHints = (ci: CiDescriptor): CiGitHints => {
  const repositoryUrl = getEnv("CIRCLE_REPOSITORY_URL");
  const repository = repositoryUrl ? resolveRepositoryFromGitUrl(repositoryUrl) : undefined;

  if (!repository) {
    return {};
  }

  const pullRequestUrl = getEnv("CIRCLE_PULL_REQUEST");
  const pullRequestNumber = pullRequestUrl ? parsePullRequestNumberFromUrl(pullRequestUrl) : undefined;

  if (!pullRequestNumber) {
    return {
      provider: repository.provider,
      repository: {
        slug: repository.slug,
        url: repository.url,
      },
      sourceBranch: getEnv("CIRCLE_BRANCH") || ci.jobRunBranch || undefined,
    };
  }

  return {
    provider: repository.provider,
    repository: {
      slug: repository.slug,
      url: repository.url,
    },
    sourceBranch: getEnv("CIRCLE_BRANCH") || ci.jobRunBranch || undefined,
    pullRequest: {
      id: pullRequestNumber,
      url: ci.pullRequestUrl || pullRequestUrl || undefined,
      title: ci.pullRequestName || undefined,
    },
  };
};
