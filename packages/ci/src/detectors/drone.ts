import { type CiDescriptor, CiType, GitProvider } from "@allurereport/core-api";

import { resolveRepositoryFromGitUrl } from "../helpers/gitProvider.js";
import { getEnv } from "../utils.js";

export const getJobRunUID = (): string => getEnv("DRONE_BUILD_NUMBER");

export const getJobRunURL = (): string => getEnv("DRONE_BUILD_LINK");

export const getJobURL = (): string => {
  const jobRunURL = getJobRunURL();
  const jobRunUID = getJobRunUID();

  return jobRunURL.replace(jobRunUID, "");
};

const getRepository = () => {
  const repoLink = getEnv("DRONE_REPO_LINK");

  return repoLink ? resolveRepositoryFromGitUrl(repoLink) : undefined;
};

const normalizeRepositoryUrl = (url: string): string =>
  url
    .trim()
    .replace(/\.git\/?$/i, "")
    .replace(/\/+$/, "");

const getPullRequestNumber = (): string | undefined => {
  const pullRequestNumber = getEnv("DRONE_PULL_REQUEST").trim();

  return pullRequestNumber && pullRequestNumber !== "0" ? pullRequestNumber : undefined;
};

const getPullRequestUrlForProvider = (
  provider: GitProvider,
  repositoryUrl: string,
  pullRequestNumber: string,
): string => {
  const normalizedRepositoryUrl = normalizeRepositoryUrl(repositoryUrl);

  switch (provider) {
    case GitProvider.Github:
      return `${normalizedRepositoryUrl}/pull/${pullRequestNumber}`;
    case GitProvider.Gitlab:
      return `${normalizedRepositoryUrl}/-/merge_requests/${pullRequestNumber}`;
    case GitProvider.Bitbucket:
      return `${normalizedRepositoryUrl}/pull-requests/${pullRequestNumber}`;
    default:
      return "";
  }
};

const getSourceBranch = (): string | undefined => {
  if (getEnv("DRONE_TAG")) {
    return undefined;
  }

  const sourceBranch = getEnv("DRONE_SOURCE_BRANCH");

  if (sourceBranch) {
    return sourceBranch;
  }

  return getPullRequestNumber() ? undefined : getEnv("DRONE_BRANCH") || undefined;
};

const getTargetBranch = (): string | undefined => {
  if (getEnv("DRONE_TAG")) {
    return undefined;
  }

  return getEnv("DRONE_TARGET_BRANCH") || (getPullRequestNumber() ? getEnv("DRONE_BRANCH") : "") || undefined;
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
    return getEnv("DRONE_TAG") ? "" : getEnv("DRONE_BRANCH");
  },

  get pullRequestUrl(): string {
    const pullRequestNumber = getPullRequestNumber();

    if (!pullRequestNumber) {
      return "";
    }

    const repository = getRepository();

    if (repository) {
      return getPullRequestUrlForProvider(repository.provider, repository.url, pullRequestNumber);
    }

    const githubServer = normalizeRepositoryUrl(getEnv("DRONE_GITHUB_SERVER") || "");
    const gitlabServer = normalizeRepositoryUrl(getEnv("DRONE_GITLAB_SERVER") || "");
    const repoLink = normalizeRepositoryUrl(getEnv("DRONE_REPO_LINK") || "");

    if (githubServer && repoLink.startsWith(githubServer)) {
      return `${repoLink}/pull/${pullRequestNumber}`;
    }

    if (gitlabServer && repoLink.startsWith(gitlabServer)) {
      return `${repoLink}/-/merge_requests/${pullRequestNumber}`;
    }

    return "";
  },

  get pullRequestName(): string {
    return getEnv("DRONE_PULL_REQUEST_TITLE");
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
    return getSourceBranch();
  },

  get targetBranch() {
    return getTargetBranch();
  },

  get pullRequest() {
    const pullRequestNumber = getPullRequestNumber();

    return pullRequestNumber
      ? {
          id: pullRequestNumber,
          url: this.pullRequestUrl || undefined,
          title: this.pullRequestName || getEnv("DRONE_PULL_REQUEST_TITLE") || undefined,
        }
      : undefined;
  },
};
