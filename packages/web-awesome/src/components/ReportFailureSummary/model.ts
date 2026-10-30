import type { Statistic } from "@allurereport/core-api";
import type { PluginGlobals } from "@allurereport/plugin-api";
import type { ReportQualityGateResults } from "types";

export type ReportFailureSummaryData = {
  unsuccessfulTests: number;
  failedQualityGates: number;
  globalErrors: number;
  hasFailure: boolean;
};

export const getReportFailureSummary = (
  stats: Statistic | undefined,
  qualityGateResults: ReportQualityGateResults | undefined,
  globals: PluginGlobals | undefined,
): ReportFailureSummaryData => {
  const unsuccessfulTests = (stats?.failed ?? 0) + (stats?.broken ?? 0);
  const failedQualityGates = Object.values(qualityGateResults ?? {})
    .flatMap((results) => results)
    .filter(({ success }) => !success).length;
  const globalErrors = globals?.errors.length ?? 0;

  return {
    unsuccessfulTests,
    failedQualityGates,
    globalErrors,
    hasFailure: unsuccessfulTests > 0 || failedQualityGates > 0 || globalErrors > 0,
  };
};
