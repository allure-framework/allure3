import {
  type AllureServiceConfig,
  type ResolvedAllureServiceConfig,
  compileExpression,
  isExpression,
  parseIntegerConfigValue,
} from "@allurereport/core-api";

const DEFAULT_UPLOAD_MAX_ATTEMPTS = 5;
const DEFAULT_UPLOAD_MAX_SIMULTANEOUS_FAILURES = 5;

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
    uploadMaxAttempts: parseIntegerConfigValue(config.uploadMaxAttempts, 1) ?? DEFAULT_UPLOAD_MAX_ATTEMPTS,
    uploadMaxSimultaneousFailures:
      parseIntegerConfigValue(config.uploadMaxSimultaneousFailures, 0) ?? DEFAULT_UPLOAD_MAX_SIMULTANEOUS_FAILURES,
  };
};
