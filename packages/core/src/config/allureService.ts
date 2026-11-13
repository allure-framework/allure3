import {
  type AllureServiceConfig,
  type ResolvedAllureServiceConfig,
  parseIntegerConfigValue,
} from "@allurereport/core-api";
import { compileExpression, isExpression } from "@allurereport/core-api/expression";

export const resolveAllureService = (
  config: AllureServiceConfig | undefined,
  env: Record<string, string>,
): ResolvedAllureServiceConfig | undefined => {
  if (!config) {
    return undefined;
  }

  const token = config.accessToken;
  const accessToken =
    token !== undefined && isExpression(token)
      ? (compileExpression(
          token,
          "allureService.accessToken",
          { env: "map" },
          { resultType: "string" },
        )({ env }) as string)
      : token;
  const uploadConcurrency = parseIntegerConfigValue(config.uploadConcurrency, 1);

  return {
    accessToken,
    private: config.private,
    ...(uploadConcurrency === undefined ? {} : { uploadConcurrency }),
    uploadMaxAttempts: parseIntegerConfigValue(config.uploadMaxAttempts, 1),
    uploadMaxSimultaneousFailures: parseIntegerConfigValue(config.uploadMaxSimultaneousFailures, 0),
  };
};
