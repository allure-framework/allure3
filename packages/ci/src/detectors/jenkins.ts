import { type Detector } from "../model.js";
import { getEnv } from "../utils.js";

export const jenkins: Detector = {
  type: "jenkins",

  get detected(): boolean {
    return getEnv("JENKINS_URL") !== "";
  },

  get jobUID(): string {
    return getEnv("JOB_NAME");
  },

  get jobURL(): string {
    return getEnv("JOB_URL");
  },

  get jobName(): string {
    return getEnv("JOB_BASE_NAME");
  },

  get jobRunUID(): string {
    return getEnv("BUILD_NUMBER");
  },

  get jobRunURL(): string {
    return getEnv("BUILD_URL");
  },

  get jobRunName(): string {
    return getEnv("BUILD_DISPLAY_NAME");
  },

  get jobRunBranch(): string {
    return "";
  },
};
