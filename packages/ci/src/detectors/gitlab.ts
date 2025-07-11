import { type Detector } from "../model.js";
import { getEnv } from "../utils.js";

export const gitlab: Detector = {
  type: "gitlab",

  get detected(): boolean {
    return getEnv("GITLAB_CI") !== "";
  },

  get jobUID(): string {
    return getEnv("CI_PROJECT_ID");
  },

  get jobURL(): string {
    return `${getEnv("CI_PROJECT_URL")}/pipelines`;
  },

  get jobName(): string {
    return getEnv("CI_PROJECT_NAME");
  },

  get jobRunUID(): string {
    return getEnv("CI_PIPELINE_ID");
  },

  get jobRunURL(): string {
    return getEnv("CI_PIPELINE_URL");
  },

  get jobRunName(): string {
    return getEnv("CI_PIPELINE_ID");
  },

  get jobRunBranch(): string {
    return getEnv("CI_COMMIT_REF_NAME");
  },
};
