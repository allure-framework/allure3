import type { MetricSample } from "@allurereport/core-api";
import { ReportFetchError, fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";

import type { StoreSignalState } from "@/stores/types";

export type MetricsWidgetData = {
  current: MetricSample[];
  display?: {
    historyMetricKey: string;
  };
  history: {
    uuid: string;
    name: string;
    timestamp: number;
    url?: string;
    metrics: Record<string, number>;
  }[];
};

export type MetricRow = MetricSample & {
  previousValue?: number;
  delta?: number;
  trend: number[];
};

export const metricsStore = signal<StoreSignalState<MetricsWidgetData>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const latestMetricSamples = (metrics: MetricSample[]): MetricSample[] => {
  const byKey = new Map<string, MetricSample>();

  metrics.forEach((metric) => {
    byKey.set(metric.key, metric);
  });

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
};

export const metricRows = (data: MetricsWidgetData): MetricRow[] => {
  const history = [...data.history].sort((a, b) => a.timestamp - b.timestamp);
  const recentHistory = [...history].reverse();

  return latestMetricSamples(data.current).map((metric) => {
    const trend = history
      .map(({ metrics }) => metrics[metric.key])
      .filter((value): value is number => Number.isFinite(value));
    const previousValue = recentHistory
      .map(({ metrics }) => metrics[metric.key])
      .find((value) => Number.isFinite(value));
    const delta = Number.isFinite(previousValue) ? metric.value - previousValue : undefined;

    return {
      ...metric,
      previousValue,
      delta,
      trend: [...trend, metric.value],
    };
  });
};

export const fetchMetricsData = async () => {
  metricsStore.value = {
    ...metricsStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<MetricsWidgetData>("widgets/metrics.json", { bustCache: true });

    metricsStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (err) {
    if (err instanceof ReportFetchError && err.response.status === 404) {
      metricsStore.value = {
        data: undefined,
        error: undefined,
        loading: false,
      };
      return;
    }

    metricsStore.value = {
      data: undefined,
      error: err instanceof Error ? err.message : String(err),
      loading: false,
    };
  }
};
