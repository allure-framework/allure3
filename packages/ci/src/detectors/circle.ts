import { type CiDescriptor, CiType } from "@allurereport/core-api";

import { parsePullRequestNumberFromUrl, resolveRepositoryFromGitUrl } from "../helpers/gitProvider.js";
import { getEnv, parseURLPath } from "../utils.js";

export const getBuildNumber = (): string => getEnv("CIRCLE_BUILD_NUM");

export const getJobRunURL = (): string => getEnv("CIRCLE_BUILD_URL");

const getJobURL = (): string => {
  const jobRunURL = getJobRunURL();
  const buildNumber = getBuildNumber();

  return jobRunURL.replace(`/${buildNumber}`, "");
};

const getRepository = () => {
  const repositoryUrl = getEnv("CIRCLE_REPOSITORY_URL");

  return repositoryUrl ? resolveRepositoryFromGitUrl(repositoryUrl) : undefined;
};

export const circle: CiDescriptor = {
  type: CiType.Circle,

  get detected(): boolean {
    const hasEnv = getEnv("CIRCLECI") !== "";
    const jobURL = getJobURL();
    const path = parseURLPath(jobURL);

    return hasEnv && path !== "";
  },

  get repoName(): string {
    return getEnv("CIRCLE_PROJECT_REPONAME");
  },

  get jobUid(): string {
    const jobURL = getJobURL();

    return parseURLPath(jobURL);
  },

  get jobUrl(): string {
    return getJobURL();
  },

  get jobName(): string {
    const username = getEnv("CIRCLE_USERNAME");
    const reponame = getEnv("CIRCLE_PROJECT_REPONAME");

    return `${username}/${reponame}`;
  },

  get jobRunUid(): string {
    return getEnv("CIRCLE_WORKFLOW_JOB_ID");
  },

  get jobRunUrl(): string {
    return getJobRunURL();
  },

  get jobRunName(): string {
    return getEnv("CIRCLE_BUILD_NUM");
  },

  get jobRunBranch(): string {
    return getEnv("CIRCLE_BRANCH");
  },

  get pullRequestUrl(): string {
    return "";
  },

  get pullRequestName(): string {
    return "";
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
    return getEnv("CIRCLE_BRANCH") || this.jobRunBranch || undefined;
  },

  get pullRequest() {
    const pullRequestUrl = getEnv("CIRCLE_PULL_REQUEST");
    const pullRequestNumber = pullRequestUrl ? parsePullRequestNumberFromUrl(pullRequestUrl) : undefined;

    return pullRequestNumber
      ? {
          id: pullRequestNumber,
          url: this.pullRequestUrl || pullRequestUrl || undefined,
          title: this.pullRequestName || undefined,
        }
      : undefined;
  },
};
