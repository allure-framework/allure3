import { CI } from "@allurereport/core-api";
import { type Detector } from "../model.js";
import { getEnv } from "../utils.js";

export const jenkins: Detector = {
  type: CI.Jenkins,

  get detected(): boolean {
    return getEnv("JENKINS_URL") !== "";
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
    return "";
  },
};
