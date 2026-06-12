import { type CiDescriptor, type CiGitHints, GitProvider } from "@allurereport/core-api";

import { getEnv } from "../utils.js";

export const resolveGitlabGitHints = (ci: CiDescriptor): CiGitHints => {
  const projectPath = getEnv("CI_PROJECT_PATH");
  const projectUrl = getEnv("CI_PROJECT_URL");
  const repository = projectPath
    ? {
        slug: projectPath,
        url: projectUrl || undefined,
      }
    : undefined;

  const mergeRequestSource = getEnv("CI_MERGE_REQUEST_SOURCE_BRANCH_NAME");
  const sourceBranch = mergeRequestSource || getEnv("CI_COMMIT_REF_NAME") || ci.jobRunBranch || undefined;
  const targetBranch = getEnv("CI_MERGE_REQUEST_TARGET_BRANCH_NAME") || undefined;

  const mergeRequestIid = getEnv("CI_MERGE_REQUEST_IID");
  const pullRequest = mergeRequestIid
    ? {
        id: mergeRequestIid,
        url: ci.pullRequestUrl || undefined,
        title: getEnv("CI_MERGE_REQUEST_TITLE") || ci.pullRequestName || undefined,
      }
    : undefined;

  return {
    provider: GitProvider.Gitlab,
    repository,
    sourceBranch,
    targetBranch,
    pullRequest,
  };
};
