import { env } from "node:process";

import { CiType } from "@allurereport/core-api";
import type { CiDescriptor } from "@allurereport/core-api";

import type { TestOpsJobParameter } from "../model.js";

export const TESTOPS_CI_TYPE: Partial<Record<CiType, string>> = {
  [CiType.Amazon]: "aws",
  [CiType.Circle]: "circleci",
};

export const ciEndpoint = (ci: CiDescriptor): string | undefined => {
  try {
    return new URL(ci.jobUrl).origin;
  } catch {
    return undefined;
  }
};

export const externalParameters = (
  ci: CiDescriptor,
  existingJobParameters: TestOpsJobParameter[] = [],
): { job: { name: string; defaultValue: string }[]; jobRun: { name: string; value: string }[] } => {
  const jobParams: Record<string, string> = {};
  const jobRunParams: Record<string, string> = {};

  for (const { name, defaultValue } of existingJobParameters) {
    jobParams[name] = defaultValue;

    if (env[name]) {
      jobRunParams[name] = env[name] as string;
    } else if (ci.type === CiType.Bitbucket && name === "CustomName" && defaultValue) {
      jobRunParams[name] = defaultValue;
    }
  }

  if (ci.jobRunBranch) {
    jobParams.Branch = ci.jobRunBranch;
    jobRunParams.Branch = ci.jobRunBranch;
  }

  if (ci.type === CiType.Bitbucket && env.CustomName) {
    jobParams.CustomName = env.CustomName;
    jobRunParams.CustomName = env.CustomName;
  }

  return {
    job: Object.entries(jobParams).map(([name, defaultValue]) => ({ name, defaultValue })),
    jobRun: Object.entries(jobRunParams).map(([name, value]) => ({ name, value })),
  };
};
