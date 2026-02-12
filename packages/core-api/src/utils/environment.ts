import type { EnvironmentsConfig } from "../environment.js";
import type { TestEnvGroup, TestResult } from "../model.js";

export const DEFAULT_ENVIRONMENT = "default";

export const matchEnvironment = (envConfig: EnvironmentsConfig, tr: Pick<TestResult, "labels">): string => {
  return (
    Object.entries(envConfig).find(([, { matcher }]) => matcher({ labels: tr.labels }))?.[0] ?? DEFAULT_ENVIRONMENT
  );
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
