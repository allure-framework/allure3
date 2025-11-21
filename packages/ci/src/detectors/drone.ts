import { type CiDescriptor, CiType } from "@allurereport/core-api";
import { getEnv } from "../utils.js";

export const getJobRunUID = (): string => getEnv("CI_BUILD_NUMBER");

export const getJobRunURL = (): string => getEnv("DRONE_BUILD_LINK");

export const getJobURL = (): string => {
  const jobRunURL = getJobRunURL();
  const jobRunUID = getJobRunUID();

  return jobRunURL.replace(jobRunUID, "");
};

export const drone: CiDescriptor = {
  type: CiType.Drone,

  get detected(): boolean {
    return getEnv("DRONE_SYSTEM_HOST") !== "";
  },

  get repoName(): string {
    return getEnv("DRONE_REPO_NAME");
  },

  get jobUid(): string {
    return getEnv("DRONE_REPO");
  },

  get jobUrl(): string {
    return getJobURL();
  },

  get jobName(): string {
    return getEnv("DRONE_REPO");
  },

  get jobRunUid(): string {
    return getJobRunUID();
  },

  get jobRunUrl(): string {
    return getJobRunURL();
  },

  get jobRunName(): string {
    return getEnv("DRONE_BUILD_NUMBER");
  },

  get jobRunBranch(): string {
    return getEnv("DRONE_BRANCH");
  },

  get pullRequestUrl(): string {
    const githubServer = getEnv("DRONE_GITHUB_SERVER");
    const gitlabServer = getEnv("DRONE_GITLAB_SERVER");
    const repoLink = getEnv("DRONE_REPO_LINK");
    const pullRequestNumber = getEnv("DRONE_PULL_REQUEST");

    if (repoLink.startsWith(githubServer)) {
      return `${repoLink}/pull/${pullRequestNumber}`;
    }

    if (repoLink.startsWith(gitlabServer)) {
      return `${repoLink}/-/merge_requests/${pullRequestNumber}`;
    }

    return "";
  },

  get pullRequestName(): string {
    return getEnv("DRONE_PULL_REQUEST_TITLE");
  },
};
