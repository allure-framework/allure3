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

const overrideIgnoringCase = (target: Record<string, unknown>, layer: ReportVariables) => {
  for (const [key, value] of Object.entries(layer)) {
    for (const existing of Object.keys(target)) {
      if (existing.toLowerCase() === key.toLowerCase()) {
        delete target[existing];
      }
    }

    target[key] = value;
  }
};

/**
 * Builds a TestOps session environment: process env, then report variables, then environment variables.
 * TestOps matches env var keys case-insensitively, so a stronger layer replaces keys that differ only in case.
 */
export const mergeSessionEnvironment = (
  processEnv: Record<string, unknown>,
  reportVariables: ReportVariables,
  ownVariables: ReportVariables,
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...processEnv };

  overrideIgnoringCase(result, reportVariables);
  overrideIgnoringCase(result, ownVariables);

  return result;
};
