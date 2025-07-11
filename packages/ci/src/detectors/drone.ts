import { CI } from "@allurereport/core-api";
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
  type: CI.Drone,

  get detected(): boolean {
    return getEnv("DRONE_SYSTEM_HOST") !== "";
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
};
