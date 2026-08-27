import { env } from "node:process";

import { Logger } from "../logger.js";

const logger = new Logger("TestOpsPlugin");

/**
 * `ALLURE_CI_ENV` is a base64-encoded JSON map of `ALLURE_*` env vars, set by one pipeline step
 * so a later one that doesn't share env with it (matrix jobs, separate containers) can still see
 * them. Must run before anything else reads an `ALLURE_*` var.
 */
export const applyAllureCiEnv = (): void => {
  const encoded = env.ALLURE_CI_ENV;

  if (!encoded) {
    return;
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Record<string, string>;

    for (const [key, value] of Object.entries(decoded)) {
      if (key.startsWith("ALLURE_")) {
        env[key] = value;
      }
    }
  } catch (error) {
    logger.warn(`Failed to decode ALLURE_CI_ENV, ignoring it: ${error}`);
  }
};
