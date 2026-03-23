import type { EnvironmentIdentity, EnvironmentsConfig } from "../environment.js";
import type { TestEnvGroup, TestResult } from "../model.js";

export const DEFAULT_ENVIRONMENT = "default";
export const MAX_ENVIRONMENT_NAME_LENGTH = 64;
export const MAX_ENVIRONMENT_ID_LENGTH = 64;
export const DEFAULT_ENVIRONMENT_IDENTITY: EnvironmentIdentity = {
  id: DEFAULT_ENVIRONMENT,
  name: DEFAULT_ENVIRONMENT,
};

const hasControlChars = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);

    // Reject ASCII control ranges: C0 (U+0000..U+001F), DEL (U+007F), and C1 (U+0080..U+009F).
    // Common examples: \u0000 (NUL), \t (TAB), \n (LF), \r (CR), \u009F.
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }

  return false;
};

export type EnvironmentValidationResult = { valid: true; normalized: string } | { valid: false; reason: string };

export const validateEnvironmentName = (name: unknown): EnvironmentValidationResult => {
  if (typeof name !== "string") {
    return { valid: false, reason: "name must be a string" };
  }

  const normalized = name.trim();

  if (normalized.length === 0) {
    return { valid: false, reason: "name must not be empty" };
  }

  if (normalized.length > MAX_ENVIRONMENT_NAME_LENGTH) {
    return {
      valid: false,
      reason: `name must not exceed ${MAX_ENVIRONMENT_NAME_LENGTH} characters`,
    };
  }

  if (hasControlChars(normalized)) {
    return { valid: false, reason: "name must not contain control characters" };
  }

  return { valid: true, normalized };
};

export const validateEnvironmentId = (environmentId: unknown): EnvironmentValidationResult => {
  if (typeof environmentId !== "string") {
    return { valid: false, reason: "id must be a string" };
  }

  const normalized = environmentId.trim();

  if (normalized.length === 0) {
    return { valid: false, reason: "id must not be empty" };
  }

  if (normalized.length > MAX_ENVIRONMENT_ID_LENGTH) {
    return {
      valid: false,
      reason: `id must not exceed ${MAX_ENVIRONMENT_ID_LENGTH} characters`,
    };
  }

  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    return {
      valid: false,
      reason: "id must contain only latin letters, digits, underscores, and hyphens",
    };
  }

  return { valid: true, normalized };
};

export const assertValidEnvironmentName = (name: unknown, source: string = "environment name"): string => {
  const validationResult = validateEnvironmentName(name);

  if (!validationResult.valid) {
    throw new Error(`Invalid ${source} ${JSON.stringify(name)}: ${validationResult.reason}`);
  }

  return validationResult.normalized;
};

export const formatNormalizedEnvironmentCollision = (
  sourcePath: string,
  normalized: string,
  originalKeys: string[],
): string =>
  `${sourcePath}: normalized key ${JSON.stringify(normalized)} is produced by original keys [${originalKeys.map((key) => JSON.stringify(key)).join(",")}]`;

const findMatchedEnvironmentIdentity = (
  envConfig: EnvironmentsConfig,
  tr: Pick<TestResult, "labels">,
): EnvironmentIdentity | undefined => {
  const match = Object.entries(envConfig).find(([, { matcher }]) => matcher({ labels: tr.labels }));

  if (!match) {
    return undefined;
  }

  const [id, descriptor] = match;

  return {
    id,
    name: descriptor.name ?? id,
  };
};

export const matchEnvironmentIdentity = (
  envConfig: EnvironmentsConfig,
  tr: Pick<TestResult, "labels">,
): EnvironmentIdentity => {
  return findMatchedEnvironmentIdentity(envConfig, tr) ?? DEFAULT_ENVIRONMENT_IDENTITY;
};

/**
 * Returns env count in the given group
 * Returns 0 if there is no envs in the group or the only one is default (shouldn't be rendered in the report)
 * @param group
 */
export const getRealEnvsCount = (group: TestEnvGroup): number => {
  const { testResultsByEnv = {} } = group ?? {};
  const envsCount = Object.keys(testResultsByEnv).length ?? 0;

  if (envsCount <= 1 && DEFAULT_ENVIRONMENT in testResultsByEnv) {
    return 0;
  }

  return envsCount;
};
