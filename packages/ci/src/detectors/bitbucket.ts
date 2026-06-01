import { type CiDescriptor, CiType, GitProvider } from "@allurereport/core-api";

import { getEnv } from "../utils.js";

export const getJobURL = (): string => {
  const origin = getEnv("BITBUCKET_GIT_HTTP_ORIGIN");

  return `${origin}/pipelines`;
};

export const bitbucket: CiDescriptor = {
  type: CiType.Bitbucket,

  get detected(): boolean {
    return getEnv("BITBUCKET_PIPELINE_UUID") !== "";
  },

  get repoName(): string {
    return getEnv("BITBUCKET_REPO_SLUG");
  },

  get jobUid(): string {
    return getEnv("BITBUCKET_REPO_FULL_NAME");
  },

  get jobUrl(): string {
    return getJobURL();
  },

  get jobName(): string {
    return getEnv("BITBUCKET_REPO_FULL_NAME");
  },

  get jobRunUid(): string {
    return getEnv("BITBUCKET_PIPELINE_UUID");
  },

  get jobRunUrl(): string {
    return `${getJobURL()}/results/${this.jobRunUid}`;
  },

  get jobRunName(): string {
    return getEnv("BITBUCKET_PIPELINE_UUID");
  },

  get jobRunBranch(): string {
    return getEnv("BITBUCKET_BRANCH");
  },

  get pullRequestUrl(): string {
    const prId = getEnv("BITBUCKET_PR_ID");

    if (!prId) {
      return "";
    }

    const origin = getEnv("BITBUCKET_GIT_HTTP_ORIGIN");

    return `${origin}/pull-requests/${prId}`;
  },

  get pullRequestName(): string {
    return "";
  },

  get provider() {
    return GitProvider.Bitbucket;
  },

  get repository() {
    const repositorySlug = getEnv("BITBUCKET_REPO_FULL_NAME");

    return repositorySlug
      ? {
          slug: repositorySlug,
          url: getEnv("BITBUCKET_GIT_HTTP_ORIGIN") || undefined,
        }
      : undefined;
  },

  get sourceBranch() {
    return getEnv("BITBUCKET_BRANCH") || this.jobRunBranch || undefined;
  },

  get targetBranch() {
    return getEnv("BITBUCKET_PR_DESTINATION_BRANCH") || undefined;
  },

  get pullRequest() {
    const prId = getEnv("BITBUCKET_PR_ID");

    return prId
      ? {
          id: prId,
          url: this.pullRequestUrl || undefined,
          title: this.pullRequestName || undefined,
        }
      : undefined;
  },
};
