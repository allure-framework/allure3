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
  const { ALLURE_TESTOPS_ACCESS_TOKEN, ALLURE_TESTOPS_ENDPOINT, ALLURE_TESTOPS_PROJECT_ID } = env;
  const {
    accessToken = ALLURE_TESTOPS_ACCESS_TOKEN,
    endpoint = ALLURE_TESTOPS_ENDPOINT,
    projectId = ALLURE_TESTOPS_PROJECT_ID,
  } = options;

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
    accessToken,
    endpoint,
    projectId,
  };
};
