import { type Detector } from "../model.js";
import { getEnv } from "../utils.js";

const getBaseURL = (): string => {
  return getEnv("GITHUB_SERVER_URL");
};

const getRunID = (): string => {
  return getEnv("GITHUB_RUN_ID");
};

const getRunNumber = (): string => {
  return getEnv("GITHUB_RUN_NUMBER");
};

const getRepo = (): string => {
  return getEnv("GITHUB_REPOSITORY");
};

const getWorkflow = (): string => {
  return getEnv("GITHUB_WORKFLOW");
};

const getJob = (): string => {
  return getEnv("GITHUB_JOB");
};

export const github: Detector = {
  type: "github",

  get detected(): boolean {
    return getEnv("GITHUB_ACTIONS") !== "";
  },

  get jobUID(): string {
    return `${getRepo()}_${getWorkflow()}`;
  },

  get jobURL(): string {
    const workflow = encodeURIComponent(`workflow:"${getWorkflow()}"`);

    return `${getBaseURL()}/${getRepo()}/actions?query=${workflow}`;
  },

  get jobName(): string {
    return `${getRepo()} - ${getWorkflow()}`;
  },

  get jobRunUID(): string {
    return getRunID();
  },

  get jobRunURL(): string {
    return `${getBaseURL()}/${getRepo()}/actions/runs/${getRunID()}`;
  },

  get jobRunName(): string {
    return `${getJob()} #${getRunNumber()}`;
  },

  get jobRunBranch(): string {
    return getEnv("GITHUB_REF");
  },
};
