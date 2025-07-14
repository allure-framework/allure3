import { type CiDescriptor, CiType } from "@allurereport/core-api";
import { getEnv } from "../utils.js";

export const jenkins: CiDescriptor = {
  type: CiType.Jenkins,

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

  get pullRequestUrl(): string {
    return "";
  },

  get pullRequestName(): string {
    return "";
  },
};
