import { type CiDescriptor, CiType } from "@allurereport/core-api";

import { resolveRepositoryFromGitUrl } from "../helpers/gitProvider.js";
import { getEnv, getReponameFromRepoUrl } from "../utils.js";

const getRepository = () => {
  const gitUrl = getEnv("GIT_URL");

  return gitUrl ? resolveRepositoryFromGitUrl(gitUrl) : undefined;
};

const isTagBuild = (): boolean => Boolean(getEnv("TAG_NAME"));

const getGitPluginBranch = (): string | undefined => {
  const localBranch = (getEnv("GIT_LOCAL_BRANCH") || "").trim();

  if (localBranch) {
    return localBranch;
  }

  const gitBranch = (getEnv("GIT_BRANCH") || "").trim();

  if (!gitBranch) {
    return undefined;
  }

  const normalizedBranch = gitBranch.replace(/^refs\/heads\//, "");
  const remoteBranchMatch = normalizedBranch.match(/^(?:refs\/remotes\/|remotes\/)?[^/]+\/(.+)$/);

  return remoteBranchMatch?.[1] ?? normalizedBranch;
};

const getBranchName = (): string | undefined => {
  if (isTagBuild()) {
    return undefined;
  }

  return getEnv("BRANCH_NAME") || getGitPluginBranch();
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
    return getBranchName() ?? "";
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
    if (isTagBuild()) {
      return undefined;
    }

    return getEnv("CHANGE_BRANCH") || getBranchName();
  },

  get targetBranch() {
    return isTagBuild() ? undefined : getEnv("CHANGE_TARGET") || undefined;
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
