import { env } from "node:process";

import { CiType } from "@allurereport/core-api";
import type { CiDescriptor } from "@allurereport/core-api";

import type { TestOpsJobParameter } from "../model.js";

/** The few providers TestOps names differently from our CiType. */
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

/**
 * Job/job-run parameters TestOps needs to run the job correctly from its side:
 * Branch (so a re-triggered build targets the branch results came from, not the
 * pipeline's default) and, on Bitbucket only, CustomName (a run label Bitbucket
 * pipelines set via that literal env var).
 *
 * `existingJobParameters` are the job's already-configured parameters (fetched
 * before this call): job.parameters is sent as a full replacement, not a merge,
 * so every existing entry has to be restated here or TestOps would drop it.
 */
export const externalParameters = (
  ci: CiDescriptor,
  existingJobParameters: TestOpsJobParameter[] = [],
): { job: { name: string; defaultValue: string }[]; jobRun: { name: string; value: string }[] } => {
  const jobParams: Record<string, string> = {};
  const jobRunParams: Record<string, string> = {};

  if (ci.jobRunBranch) {
    jobParams.Branch = ci.jobRunBranch;
    jobRunParams.Branch = ci.jobRunBranch;
  }

  if (ci.type === CiType.Bitbucket && env.CustomName) {
    jobParams.CustomName = env.CustomName;
    jobRunParams.CustomName = env.CustomName;
  }

  for (const { name, defaultValue } of existingJobParameters) {
    jobParams[name] = defaultValue;

    if (env[name]) {
      jobRunParams[name] = env[name] as string;
    } else if (ci.type === CiType.Bitbucket && name === "CustomName" && defaultValue) {
      jobRunParams[name] = defaultValue;
    }
  }

  return {
    job: Object.entries(jobParams).map(([name, defaultValue]) => ({ name, defaultValue })),
    jobRun: Object.entries(jobRunParams).map(([name, value]) => ({ name, value })),
  };
};
