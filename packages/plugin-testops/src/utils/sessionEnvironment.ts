import type { ReportVariables } from "@allurereport/core-api";

/**
 * Picks the variables an environment defines on top of the report-level ones.
 * `mergedVariables` is what the store returns for the environment (report variables spread with its own).
 */
export const ownEnvironmentVariables = (
  reportVariables: ReportVariables,
  mergedVariables: ReportVariables,
): ReportVariables =>
  Object.fromEntries(Object.entries(mergedVariables).filter(([key, value]) => reportVariables[key] !== value));

/**
 * Builds a TestOps session environment: process env, then report variables, then environment variables.
 * TestOps matches session keys against the project's env var schema case-sensitively, so keys are overridden as is.
 */
export const mergeSessionEnvironment = (
  processEnv: Record<string, unknown>,
  reportVariables: ReportVariables,
  ownVariables: ReportVariables,
): Record<string, unknown> => ({ ...processEnv, ...reportVariables, ...ownVariables });
