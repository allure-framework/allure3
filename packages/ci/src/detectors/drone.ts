import { type Detector } from "../model.js";
import { getEnv } from "../utils.js";

export const getJobRunUID = (): string => getEnv("CI_BUILD_NUMBER");

export const getJobRunURL = (): string => getEnv("DRONE_BUILD_LINK");

export const getJobURL = (): string => {
  const jobRunURL = getJobRunURL();
  const jobRunUID = getJobRunUID();

  return jobRunURL.replace(jobRunUID, "");
};

export const drone: Detector = {
  type: "drone",

  get detected(): boolean {
    return getEnv("DRONE_SYSTEM_HOST") !== "";
  },

  get jobUID(): string {
    return getEnv("DRONE_REPO");
  },

  get jobURL(): string {
    return getJobURL();
  },

  get jobName(): string {
    return getEnv("DRONE_REPO");
  },

  get jobRunUID(): string {
    return getJobRunUID();
  },

  get jobRunURL(): string {
    return getJobRunURL();
  },

  get jobRunName(): string {
    return getEnv("DRONE_BUILD_NUMBER");
  },

  get jobRunBranch(): string {
    return getEnv("DRONE_BRANCH");
  },
};
