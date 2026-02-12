import { type CiDescriptor, CiType } from "@allurereport/core-api";
import { getEnv } from "../utils.js";

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
    return getEnv("CI_COMMIT_REF_NAME");
  },

  get pullRequestUrl(): string {
    const mergeRequestIID = getEnv("CI_MERGE_REQUEST_IID");

    if (!mergeRequestIID) {
      return "";
    }

    const projectUrl = getEnv("CI_PROJECT_URL");

    return `${projectUrl}/-/merge_requests/${mergeRequestIID}`;
  },

  get pullRequestName(): string {
    return getEnv("CI_MERGE_REQUEST_TITLE");
  },
};
