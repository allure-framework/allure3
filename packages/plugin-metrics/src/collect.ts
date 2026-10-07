import { statusesList } from "@allurereport/core-api";

import type { MetricLine, MetricsInput } from "./model.js";

const finiteOrZero = (value: number | undefined): number => (Number.isFinite(value) ? (value as number) : 0);

const collectStatusMetrics = (input: MetricsInput): MetricLine[] =>
  statusesList.map((status) => ({
    name: "launch_status",
    key: status,
    value: finiteOrZero(input.statistic[status]),
  }));

/**
 * Mirrors Allure 2 `GroupTime`: `duration` is the wall-clock span of the whole run, the other values are
 * derived from the individual test durations.
 */
const collectTimeMetrics = (input: MetricsInput): MetricLine[] => {
  let start: number | undefined;
  let stop: number | undefined;
  let minDuration: number | undefined;
  let maxDuration: number | undefined;
  let sumDuration = 0;

  for (const { start: trStart, stop: trStop, duration } of input.testResults) {
    if (Number.isFinite(trStart)) {
      start = start === undefined ? trStart : Math.min(start, trStart as number);
    }
    if (Number.isFinite(trStop)) {
      stop = stop === undefined ? trStop : Math.max(stop, trStop as number);
    }
    if (Number.isFinite(duration)) {
      minDuration = minDuration === undefined ? duration : Math.min(minDuration, duration as number);
      maxDuration = maxDuration === undefined ? duration : Math.max(maxDuration, duration as number);
      sumDuration += duration as number;
    }
  }

  const wallClock = start !== undefined && stop !== undefined ? stop - start : 0;

  return [
    { name: "launch_time", key: "duration", value: wallClock },
    { name: "launch_time", key: "min_duration", value: finiteOrZero(minDuration) },
    { name: "launch_time", key: "max_duration", value: finiteOrZero(maxDuration) },
    { name: "launch_time", key: "sum_duration", value: sumDuration },
    { name: "launch_time", key: "start", value: finiteOrZero(start) },
    { name: "launch_time", key: "stop", value: finiteOrZero(stop) },
  ];
};

const collectCategoryMetrics = (input: MetricsInput): MetricLine[] => {
  const counts = new Map<string, number>();

  for (const { categories } of input.testResults) {
    for (const { name } of categories ?? []) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return [...counts.entries()].map(([key, value]) => ({ name: "launch_problems", key, value }));
};

const collectRetryMetrics = (input: MetricsInput): MetricLine[] => [
  { name: "launch_retries", key: "retries", value: input.retries },
  { name: "launch_retries", key: "run", value: input.testResults.length },
];

const collectPerformanceMetrics = (input: MetricsInput): MetricLine[] => {
  const grouped = new Map<string, number[]>();

  for (const { key, value } of input.performanceMetrics ?? []) {
    if (key && Number.isFinite(value)) {
      grouped.set(key, [...(grouped.get(key) ?? []), value]);
    }
  }

  return [...grouped.entries()].map(([key, values]) => ({
    name: "launch_metric",
    key,
    value: values.reduce((acc, value) => acc + value, 0) / values.length,
  }));
};

/**
 * Builds the list of metrics shared by all the exporters. The function is pure on purpose, so charts
 * (which operate on the same `statistic` and `testResults`) can reuse it.
 */
export const collectMetrics = (input: MetricsInput): MetricLine[] => [
  ...collectStatusMetrics(input),
  ...collectTimeMetrics(input),
  ...collectCategoryMetrics(input),
  ...collectRetryMetrics(input),
  ...collectPerformanceMetrics(input),
];
