import { type CiDescriptor, type CiGitHints } from "@allurereport/core-api";

import { resolveRepositoryFromGitUrl } from "../helpers/gitProvider.js";
import { getEnv } from "../utils.js";

export const resolveJenkinsGitHints = (ci: CiDescriptor): CiGitHints => {
  const gitUrl = getEnv("GIT_URL");
  const repository = gitUrl ? resolveRepositoryFromGitUrl(gitUrl) : undefined;

  if (!repository) {
    return {};
  }

  const changeId = getEnv("CHANGE_ID");
  const pullRequest = changeId
    ? {
        id: changeId,
        url: ci.pullRequestUrl || getEnv("CHANGE_URL") || undefined,
        title: ci.pullRequestName || getEnv("CHANGE_TITLE") || undefined,
      }
    : undefined;

  return {
    provider: repository.provider,
    repository: {
      slug: repository.slug,
      url: repository.url,
    },
    sourceBranch: getEnv("CHANGE_BRANCH") || getEnv("BRANCH_NAME") || ci.jobRunBranch || undefined,
    targetBranch: getEnv("CHANGE_TARGET") || undefined,
    pullRequest,
  };
};
