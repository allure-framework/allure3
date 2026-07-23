import { env } from "node:process";

import type { TestOpsPluginOptions } from "../model.js";

export const resolvePluginOptions = (options: TestOpsPluginOptions): Omit<TestOpsPluginOptions, "filter"> => {
  const { ALLURE_TOKEN, ALLURE_ENDPOINT, ALLURE_PROJECT_ID, ALLURE_LAUNCH_TAGS, ALLURE_LAUNCH_NAME } = env;
  const {
    accessToken = ALLURE_TOKEN,
    endpoint = ALLURE_ENDPOINT,
    projectId = ALLURE_PROJECT_ID,
    launchTags = ALLURE_LAUNCH_TAGS,
    launchName = ALLURE_LAUNCH_NAME,
    autocloseLaunch,
    uploadRateLimit,
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
    ...(autocloseLaunch !== undefined ? { autocloseLaunch } : {}),
    ...(uploadRateLimit !== undefined ? { uploadRateLimit } : {}),
  };
};
