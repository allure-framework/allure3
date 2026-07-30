import type { MetricSample } from "@allurereport/core-api";
import { ReportFetchError, fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";

import type { StoreSignalState } from "@/stores/types";

export type MetricsHistoryPoint = {
  uuid: string;
  name: string;
  timestamp: number;
  url?: string;
  metrics: Record<string, number>;
};

export type MetricsWidgetData = {
  current: MetricSample[];
  display?: {
    historyMetricKey: string;
  };
  history: MetricsHistoryPoint[];
};

export type MetricRow = MetricSample & {
  count: number;
  total: number;
  min: number;
  max: number;
  previousValue?: number;
  delta?: number;
  trend: number[];
};

export type MetricSummaryRow = {
  key: string;
  group?: string;
  groupTitle?: string;
  title?: string;
  unit?: string;
  better?: MetricSample["better"];
  count?: number;
  totalMs?: number;
  avgMs?: number;
  minMs?: number;
  maxMs?: number;
  source?: string;
  delta?: number;
  trend: number[];
};

export type MetricHistoryRow = {
  uuid: string;
  name: string;
  timestamp: number;
  url?: string;
  value: number;
  delta?: number;
};

const metricNamespace = (key: string): string | undefined => {
  const [namespace] = key.split(".");

  return namespace || undefined;
};

export const metricsStore = signal<StoreSignalState<MetricsWidgetData>>({
  loading: true,
  error: undefined,
  data: undefined,
});

const sortedHistory = (history: MetricsHistoryPoint[]) => [...history].sort((a, b) => a.timestamp - b.timestamp);

const latestPreviousValue = (history: MetricsHistoryPoint[], key: string): number | undefined => {
  for (let i = history.length - 1; i >= 0; i--) {
    const value = history[i]?.metrics[key];

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
};

export const defaultMetricKey = (data: MetricsWidgetData): string | undefined => {
  if (data.display?.historyMetricKey && data.current.some(({ key }) => key === data.display?.historyMetricKey)) {
    return data.display.historyMetricKey;
  }

  const rows = metricRows(data);
  const [candidate] = [...rows].sort((a, b) => b.value - a.value);

  return candidate?.key;
};

export const metricRows = (data: MetricsWidgetData): MetricRow[] => {
  const history = sortedHistory(data.history);
  const byKey = new Map<string, MetricSample[]>();

  data.current.forEach((metric) => {
    byKey.set(metric.key, [...(byKey.get(metric.key) ?? []), metric]);
  });

  return [...byKey.entries()]
    .map(([key, samples]) => {
      const metric = samples.at(-1)!;
      const values = samples.map(({ value }) => value);
      const total = values.reduce((acc, value) => acc + value, 0);
      const value = total / values.length;
      const trend = history
        .map(({ metrics }) => metrics[key])
        .filter((value): value is number => Number.isFinite(value));
      const previousValue = latestPreviousValue(history, key);
      const delta = Number.isFinite(previousValue) ? value - previousValue : undefined;

      return {
        ...metric,
        value,
        count: values.length,
        total,
        min: Math.min(...values),
        max: Math.max(...values),
        previousValue,
        delta,
        trend: [...trend, value],
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
};

export const metricSummaryRows = (data: MetricsWidgetData): MetricSummaryRow[] => {
  return metricRows(data).map((row) => ({
    key: row.key,
    title: row.title,
    group: row.group ?? metricNamespace(row.key),
    groupTitle: row.groupTitle,
    unit: row.unit,
    better: row.better,
    source: row.source,
    count: row.count,
    totalMs: row.total,
    avgMs: row.value,
    minMs: row.min,
    maxMs: row.max,
    delta: row.delta,
    trend: row.trend,
  }));
};

export const metricHistoryRows = (data: MetricsWidgetData, key: string): MetricHistoryRow[] => {
  const rows = sortedHistory(data.history)
    .map((point) => {
      const value = point.metrics[key];

      if (!Number.isFinite(value)) {
        return undefined;
      }

      return {
        uuid: point.uuid,
        name: point.name,
        timestamp: point.timestamp,
        ...(point.url ? { url: point.url } : {}),
        value,
      };
    })
    .filter((row): row is Omit<MetricHistoryRow, "delta"> => Boolean(row));

  return rows.map((row, index) => {
    const previousValue = rows[index - 1]?.value;

    return {
      ...row,
      delta: Number.isFinite(previousValue) ? row.value - previousValue : undefined,
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
