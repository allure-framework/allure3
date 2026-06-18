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
  previousValue?: number;
  delta?: number;
  trend: number[];
};

export type MetricPhaseRow = {
  key: string;
  group?: string;
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

const phaseFields = ["count", "totalMs", "avgMs", "minMs", "maxMs"] as const;
type PhaseField = (typeof phaseFields)[number];

const isPhaseField = (value: string): value is PhaseField => phaseFields.includes(value as PhaseField);

const metricNamespace = (key: string): string | undefined => {
  const [namespace] = key.split(".");

  return namespace || undefined;
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

const latestMetricSamplesInInputOrder = (metrics: MetricSample[]): MetricSample[] => {
  const byKey = new Map<string, MetricSample>();

  metrics.forEach((metric) => {
    byKey.set(metric.key, metric);
  });

  const seen = new Set<string>();

  return metrics
    .filter(({ key }) => {
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map(({ key }) => byKey.get(key))
    .filter((metric): metric is MetricSample => Boolean(metric));
};

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

  const phaseRows = metricPhaseRows(data);
  const totalRows = phaseRows.filter(
    (row): row is MetricPhaseRow & { avgMs: number } => row.key.endsWith(".total") && Number.isFinite(row.avgMs),
  );
  const candidates =
    totalRows.length > 0
      ? totalRows
      : phaseRows.filter((row): row is MetricPhaseRow & { avgMs: number } => Number.isFinite(row.avgMs));
  const [candidate] = [...candidates].sort((a, b) => b.avgMs - a.avgMs);

  if (candidate) {
    return `${candidate.key}.avgMs`;
  }

  return latestMetricSamples(data.current)[0]?.key;
};

export const metricRows = (data: MetricsWidgetData): MetricRow[] => {
  const history = sortedHistory(data.history);

  return latestMetricSamples(data.current).map((metric) => {
    const trend = history
      .map(({ metrics }) => metrics[metric.key])
      .filter((value): value is number => Number.isFinite(value));
    const previousValue = latestPreviousValue(history, metric.key);
    const delta = Number.isFinite(previousValue) ? metric.value - previousValue : undefined;

    return {
      ...metric,
      previousValue,
      delta,
      trend: [...trend, metric.value],
    };
  });
};

export const metricPhaseRows = (data: MetricsWidgetData): MetricPhaseRow[] => {
  const byPhase = new Map<string, MetricPhaseRow>();
  const latestCurrent = new Map(latestMetricSamples(data.current).map((metric) => [metric.key, metric]));
  const history = sortedHistory(data.history);

  latestMetricSamplesInInputOrder(data.current).forEach((metric) => {
    const fieldStart = metric.key.lastIndexOf(".");

    if (fieldStart < 1) {
      return;
    }

    const field = metric.key.slice(fieldStart + 1);

    if (!isPhaseField(field)) {
      return;
    }

    const phase = metric.key.slice(0, fieldStart);
    const row = byPhase.get(phase) ?? {
      key: phase,
      ...(metric.group ? { group: metric.group } : metricNamespace(phase) ? { group: metricNamespace(phase) } : {}),
      source: metric.source,
      trend: [],
    };

    row[field] = metric.value;
    byPhase.set(phase, row);
  });

  return [...byPhase.values()].map((row) => {
    const metricKey = `${row.key}.avgMs`;
    const currentAvg = latestCurrent.get(metricKey)?.value;
    const trend = history
      .map(({ metrics }) => metrics[metricKey])
      .filter((value): value is number => Number.isFinite(value));
    const previousValue = latestPreviousValue(history, metricKey);
    const delta =
      typeof currentAvg === "number" && Number.isFinite(previousValue) ? currentAvg - previousValue : undefined;

    return {
      ...row,
      delta,
      trend: typeof currentAvg === "number" ? [...trend, currentAvg] : trend,
    };
  });
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
