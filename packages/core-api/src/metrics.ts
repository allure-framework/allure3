export type MetricBetter = "lower" | "higher" | "neutral";

export interface PerformanceGroupConfig {
  title: string;
}

export interface PerformanceMetricConfig {
  title: string;
  unit: string;
  better: Exclude<MetricBetter, "neutral">;
  group?: string;
}

export interface PerformanceConfig {
  groups?: Record<string, PerformanceGroupConfig>;
  metrics?: Record<string, PerformanceMetricConfig>;
}

export interface AllurePerformanceResult {
  id: string;
  key: string;
  value: any;
  start: number;
  stop: number;
}

export interface MetricSample extends AllurePerformanceResult {
  value: number;
  source?: string;
  title?: string;
  unit?: string;
  group?: string;
  groupTitle?: string;
  better?: MetricBetter;
}

export const resolveMetricSamples = (
  metrics: readonly MetricSample[],
  performance: PerformanceConfig = {},
): MetricSample[] => {
  const metricsConfig = performance.metrics ?? {};
  const groupsConfig = performance.groups ?? {};

  return metrics.map((metric) => {
    const metricConfig = metricsConfig[metric.key];
    const group = metricConfig?.group ?? metric.group;
    const groupConfig = group ? groupsConfig[group] : undefined;

    return {
      ...metric,
      ...(metricConfig?.title ? { title: metricConfig.title } : {}),
      ...(metricConfig?.unit ? { unit: metricConfig.unit } : {}),
      ...(group ? { group } : {}),
      ...(groupConfig?.title ? { groupTitle: groupConfig.title } : {}),
      ...(metricConfig?.better ? { better: metricConfig.better } : {}),
    };
  });
};
