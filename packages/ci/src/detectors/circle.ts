import { CI } from "@allurereport/core-api";
import { type Detector } from "../model.js";
import { getEnv, parseURLPath } from "../utils.js";

export const getBuildNumber = (): string => getEnv("CIRCLE_BUILD_NUM");

export const getJobRunURL = (): string => getEnv("CIRCLE_BUILD_URL");

const getJobURL = (): string => {
  const jobRunURL = getJobRunURL();
  const buildNumber = getBuildNumber();

  return jobRunURL.replace(`/${buildNumber}`, "");
};

export const circle: Detector = {
  type: CI.Circle,

  get detected(): boolean {
    const hasEnv = getEnv("CIRCLECI") !== "";
    const jobURL = getJobURL();
    const path = parseURLPath(jobURL);

    return hasEnv && path !== "";
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
};
