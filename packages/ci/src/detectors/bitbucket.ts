import { type Detector } from "../model.js";
import { getEnv } from "../utils.js";

export const getJobURL = (): string => {
  const origin = getEnv("BITBUCKET_GIT_HTTP_ORIGIN");

  return `${origin}/pipelines`;
};

export const bitbucket: Detector = {
  type: "bitbucket",

  get detected(): boolean {
    return getEnv("BITBUCKET_PIPELINE_UUID") !== "";
  },

  get jobUID(): string {
    return getEnv("BITBUCKET_REPO_FULL_NAME");
  },

  get jobURL(): string {
    return getJobURL();
  },

  get jobName(): string {
    return getEnv("BITBUCKET_REPO_FULL_NAME");
  },

  get jobRunUID(): string {
    return getEnv("BITBUCKET_PIPELINE_UUID");
  },

  get jobRunURL(): string {
    return `${getJobURL()}/results/${this.jobRunUID}`;
  },

  get jobRunName(): string {
    return getEnv("BITBUCKET_PIPELINE_UUID");
  },

  get jobRunBranch(): string {
    return getEnv("BITBUCKET_BRANCH");
  },
};
