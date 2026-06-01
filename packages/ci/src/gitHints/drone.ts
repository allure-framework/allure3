import { type CiDescriptor, type CiGitHints } from "@allurereport/core-api";

import { resolveRepositoryFromGitUrl } from "../helpers/gitProvider.js";
import { getEnv } from "../utils.js";

export const resolveDroneGitHints = (ci: CiDescriptor): CiGitHints => {
  const repoLink = getEnv("DRONE_REPO_LINK");
  const repository = repoLink ? resolveRepositoryFromGitUrl(repoLink) : undefined;

  if (!repository) {
    return {};
  }

  const pullRequestNumber = getEnv("DRONE_PULL_REQUEST");

  if (pullRequestNumber === "0" || pullRequestNumber === "") {
    return {
      provider: repository.provider,
      repository: {
        slug: repository.slug,
        url: repository.url,
      },
      sourceBranch: getEnv("DRONE_BRANCH") || ci.jobRunBranch || undefined,
    };
  }

  const pullRequest = {
    id: pullRequestNumber,
    url: ci.pullRequestUrl || undefined,
    title: ci.pullRequestName || getEnv("DRONE_PULL_REQUEST_TITLE") || undefined,
  };

  return {
    provider: repository.provider,
    repository: {
      slug: repository.slug,
      url: repository.url,
    },
    sourceBranch: getEnv("DRONE_SOURCE_BRANCH") || getEnv("DRONE_BRANCH") || ci.jobRunBranch || undefined,
    targetBranch: getEnv("DRONE_TARGET_BRANCH") || undefined,
    pullRequest,
  };
};
