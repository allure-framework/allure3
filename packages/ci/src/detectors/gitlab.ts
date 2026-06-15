import { type CiDescriptor, CiType, GitProvider } from "@allurereport/core-api";

import { getEnv } from "../utils.js";

const getMergeRequestProjectUrl = (): string => getEnv("CI_MERGE_REQUEST_PROJECT_URL") || getEnv("CI_PROJECT_URL");

const isTagPipeline = (): boolean => Boolean(getEnv("CI_COMMIT_TAG"));

const getSourceBranch = (): string | undefined => {
  if (isTagPipeline()) {
    return undefined;
  }

  return (
    getEnv("CI_MERGE_REQUEST_SOURCE_BRANCH_NAME") ||
    getEnv("CI_COMMIT_BRANCH") ||
    getEnv("CI_COMMIT_REF_NAME") ||
    undefined
  );
};

export const gitlab: CiDescriptor = {
  type: CiType.Gitlab,

  get detected(): boolean {
    return getEnv("GITLAB_CI") !== "";
  },

  get repoName(): string {
    return getEnv("CI_PROJECT_NAME");
  },

  get jobUid(): string {
    return getEnv("CI_PROJECT_ID");
  },

  get jobUrl(): string {
    return `${getEnv("CI_PROJECT_URL")}/pipelines`;
  },

  get jobName(): string {
    return getEnv("CI_PROJECT_NAME");
  },

  get jobRunUid(): string {
    return getEnv("CI_PIPELINE_ID");
  },

  get jobRunUrl(): string {
    return getEnv("CI_PIPELINE_URL");
  },

  get jobRunName(): string {
    return getEnv("CI_PIPELINE_ID");
  },

  get jobRunBranch(): string {
    return getSourceBranch() || "";
  },

  get pullRequestUrl(): string {
    const mergeRequestIID = getEnv("CI_MERGE_REQUEST_IID");

    if (!mergeRequestIID) {
      return "";
    }

    const projectUrl = getMergeRequestProjectUrl().replace(/\/+$/, "");

    return projectUrl ? `${projectUrl}/-/merge_requests/${mergeRequestIID}` : "";
  },

  get pullRequestName(): string {
    return getEnv("CI_MERGE_REQUEST_TITLE");
  },

  get provider() {
    return GitProvider.Gitlab;
  },

  get repository() {
    const projectPath = getEnv("CI_PROJECT_PATH");

    return projectPath
      ? {
          slug: projectPath,
          url: getEnv("CI_PROJECT_URL") || undefined,
        }
      : undefined;
  },

  get sourceBranch() {
    return getSourceBranch();
  },

  get targetBranch() {
    return getEnv("CI_MERGE_REQUEST_TARGET_BRANCH_NAME") || undefined;
  },

  get pullRequest() {
    const mergeRequestIid = getEnv("CI_MERGE_REQUEST_IID");

    return mergeRequestIid
      ? {
          id: mergeRequestIid,
          url: this.pullRequestUrl || undefined,
          title: getEnv("CI_MERGE_REQUEST_TITLE") || this.pullRequestName || undefined,
        }
      : undefined;
  },
};
