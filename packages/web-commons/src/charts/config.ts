import { ChartType, type ChartOptions } from "@allurereport/charts-api";

/** Validate external chart settings once when configuring a report plugin. */
export const validateChartsOptions = (charts: ChartOptions[]): void => {
  for (const options of charts) {
    if (options.type !== ChartType.StabilityDistribution) {
      continue;
    }
    const { limit, stabilizationPeriod } = options;
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
      throw new RangeError("stabilityDistribution.limit must be a non-negative integer");
    }
    if (stabilizationPeriod !== undefined && (!Number.isInteger(stabilizationPeriod) || stabilizationPeriod < 1)) {
      throw new RangeError("stabilityDistribution.stabilizationPeriod must be a positive integer");
    }
  }
};
