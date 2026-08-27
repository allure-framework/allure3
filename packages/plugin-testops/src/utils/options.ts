import { env } from "node:process";

import { parseEnvBool } from "../gitFlow/options.js";
import type { TestOpsPluginOptions } from "../model.js";

export const resolvePluginOptions = (options: TestOpsPluginOptions): Omit<TestOpsPluginOptions, "filter"> => {
  const { ALLURE_TOKEN, ALLURE_ENDPOINT, ALLURE_PROJECT_ID, ALLURE_LAUNCH_TAGS, ALLURE_LAUNCH_NAME, ALLURE_LAUNCH_ID } =
    env;
  const {
    accessToken = ALLURE_TOKEN,
    endpoint = ALLURE_ENDPOINT,
    projectId = ALLURE_PROJECT_ID,
    launchTags = ALLURE_LAUNCH_TAGS,
    launchName = ALLURE_LAUNCH_NAME,
    launchId = ALLURE_LAUNCH_ID ? Number(ALLURE_LAUNCH_ID) : undefined,
    autocloseLaunch,
    uploadRateLimit,
    reopenClosedLaunch = parseEnvBool(env.ALLURE_REOPEN_CLOSED_LAUNCH) ?? false,
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
    ...(launchId !== undefined && !Number.isNaN(launchId) ? { launchId } : {}),
    reopenClosedLaunch,
  };
};
