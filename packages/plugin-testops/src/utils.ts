import type { TestStepResult } from "@allurereport/core-api";
import { env } from "node:process";
import type { TestopsPluginOptions } from "./model.js";

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

export const resolvePluginOptions = (options: TestopsPluginOptions): Omit<TestopsPluginOptions, "filter"> => {
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

  return {
    launchName: launchName || "Allure Report",
    launchTags: tags,
    accessToken: accessToken || "",
    endpoint: endpoint || "",
    projectId: projectId || "",
  };
};
