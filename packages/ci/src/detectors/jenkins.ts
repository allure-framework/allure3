import { type CiDescriptor, CiType } from "@allurereport/core-api";

import { resolveRepositoryFromGitUrl } from "../helpers/gitProvider.js";
import { getEnv, getReponameFromRepoUrl } from "../utils.js";

const getRepository = () => {
  const gitUrl = getEnv("GIT_URL");

  return gitUrl ? resolveRepositoryFromGitUrl(gitUrl) : undefined;
};

export const jenkins: CiDescriptor = {
  type: CiType.Jenkins,

  get detected(): boolean {
    return getEnv("JENKINS_URL") !== "";
  },

  get repoName(): string {
    const gitUrl = getEnv("GIT_URL");

    if (!gitUrl) {
      return "";
    }

    return getReponameFromRepoUrl(gitUrl);
  },

  get jobUid(): string {
    return getEnv("JOB_NAME");
  },

  get jobUrl(): string {
    return getEnv("JOB_URL");
  },

  get jobName(): string {
    return getEnv("JOB_BASE_NAME");
  },

  get jobRunUid(): string {
    return getEnv("BUILD_NUMBER");
  },

  get jobRunUrl(): string {
    return getEnv("BUILD_URL");
  },

  get jobRunName(): string {
    return getEnv("BUILD_DISPLAY_NAME");
  },

  get jobRunBranch(): string {
    return getEnv("BRANCH_NAME");
  },

  get pullRequestUrl(): string {
    return getEnv("CHANGE_URL");
  },

  get pullRequestName(): string {
    return getEnv("CHANGE_TITLE");
  },

  get provider() {
    return getRepository()?.provider;
  },

  get repository() {
    const repository = getRepository();

    return repository
      ? {
          slug: repository.slug,
          url: repository.url,
        }
      : undefined;
  },

  get sourceBranch() {
    return getEnv("CHANGE_BRANCH") || getEnv("BRANCH_NAME") || this.jobRunBranch || undefined;
  },

  get targetBranch() {
    return getEnv("CHANGE_TARGET") || undefined;
  },

  get pullRequest() {
    const changeId = getEnv("CHANGE_ID");

    return changeId
      ? {
          id: changeId,
          url: this.pullRequestUrl || getEnv("CHANGE_URL") || undefined,
          title: this.pullRequestName || getEnv("CHANGE_TITLE") || undefined,
        }
      : undefined;
  },
};
