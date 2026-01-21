import type { TestStepResult } from "@allurereport/core-api";
import { env } from "node:process";
import type { TestopsUploaderPluginOptions } from "./model.js";

export const unwrapStepsAttachments = (steps: TestStepResult[]): TestStepResult[] => {
  return steps.map((step) => {
    if (step.type === "attachment") {
      return {
        ...step,
        attachment: step.link,
      };
    }

    if (step.steps) {
      return {
        ...step,
        steps: unwrapStepsAttachments(step.steps),
      };
    }

    return step;
  });
};

export const resolvePluginOptions = (options: TestopsUploaderPluginOptions): TestopsUploaderPluginOptions => {
  const { ALLURE_TOKEN, ALLURE_ENDPOINT, ALLURE_PROJECT_ID, ALLURE_LAUNCH_TAGS, ALLURE_LAUNCH_NAME } = env;
  const {
    accessToken = ALLURE_TOKEN,
    endpoint = ALLURE_ENDPOINT,
    projectId = ALLURE_PROJECT_ID,
    launchTags = ALLURE_LAUNCH_TAGS,
    launchName = ALLURE_LAUNCH_NAME,
  } = options;
  const tags = !launchTags
    ? []
    : Array.isArray(launchTags)
      ? launchTags
      : launchTags.split(",").map((tag) => tag.trim());

  if (!accessToken) {
    throw new Error("Allure3 TestOps plugin: accessToken is required");
  }

  if (!endpoint) {
    throw new Error("Allure3 TestOps plugin: endpoint is required");
  }

  if (!projectId) {
    throw new Error("Allure3 TestOps plugin: projectId is required");
  }

  return {
    launchName: launchName || "Allure Report",
    launchTags: tags,
    accessToken,
    endpoint,
    projectId,
  };
};
