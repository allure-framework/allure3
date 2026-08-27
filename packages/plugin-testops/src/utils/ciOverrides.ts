import { env } from "node:process";

import type { CiDescriptor } from "@allurereport/core-api";

/**
 * Lets `ALLURE_`-prefixed env vars override any CI-detected field: when a detector gets it
 * wrong or the CI is exotic, the user can force individual fields without touching
 * `packages/ci`.
 */
type OverridableField = "jobUid" | "jobUrl" | "jobName" | "jobRunUid" | "jobRunUrl" | "jobRunName" | "jobRunBranch";

const OVERRIDABLE_FIELDS: readonly [OverridableField, string][] = [
  ["jobUid", "ALLURE_JOB_UID"],
  ["jobUrl", "ALLURE_JOB_URL"],
  ["jobName", "ALLURE_JOB_NAME"],
  ["jobRunUid", "ALLURE_JOB_RUN_UID"],
  ["jobRunUrl", "ALLURE_JOB_RUN_URL"],
  ["jobRunName", "ALLURE_JOB_RUN_NAME"],
  ["jobRunBranch", "ALLURE_JOB_RUN_BRANCH"],
];

export const applyCiOverrides = (ci: CiDescriptor): CiDescriptor => {
  const overrides: Partial<Record<OverridableField, string>> = {};

  for (const [field, envVar] of OVERRIDABLE_FIELDS) {
    const value = env[envVar];

    if (value) {
      overrides[field] = value;
    }
  }

  return Object.keys(overrides).length > 0 ? { ...ci, ...overrides } : ci;
};
