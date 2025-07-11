import { CI } from "@allurereport/core-api";
import { type Detector } from "../model.js";
import { getEnv } from "../utils.js";

export const gitlab: Detector = {
  type: CI.Gitlab,

  get detected(): boolean {
    return getEnv("GITLAB_CI") !== "";
  },

  get jobUid(): string {
    return getEnv("CI_PROJECT_ID");
  },

  get jobUrl(): string {
    return `${getEnv("CI_PROJECT_URL")}/pipelines`;
  },

  get jobName(): string {
    return getEnv("CI_PROJECT_NAME");
  },

  get jobRunUid(): string {
    return getEnv("CI_PIPELINE_ID");
  },

  get jobRunUrl(): string {
    return getEnv("CI_PIPELINE_URL");
  },

  get jobRunName(): string {
    return getEnv("CI_PIPELINE_ID");
  },

  get jobRunBranch(): string {
    return getEnv("CI_COMMIT_REF_NAME");
  },
};
