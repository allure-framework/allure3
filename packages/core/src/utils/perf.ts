import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import type { AllurePerformanceResult } from "@allurereport/core-api";

export const PERF_METRICS_FILE = "performance.json";
export const perfMetricsFileName = (reportUuid: string) => `${reportUuid}-perf.json`;

type PerfMetricMetadata = {
  title?: string;
  unit?: string;
  group?: string;
  groupTitle?: string;
  better?: "neutral";
};

type PerfMetricSpan = {
  name: string;
  startTimeMs: number;
  durationMs: number;
};

type PerfMetricAggregate = {
  name: string;
  count: number;
  totalMs: number;
  startTimeMs: number;
  stopTimeMs: number;
};

type PerfMetricCounter = {
  name: string;
  value: number;
  startTimeMs: number;
  stopTimeMs: number;
  metadata?: PerfMetricMetadata;
};

const MARK_PREFIX = "allure:perf:";
const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const SPANS: PerfMetricSpan[] = [];
const AGGREGATES = new Map<string, PerfMetricAggregate>();
const COUNTERS = new Map<string, PerfMetricCounter>();
const MARKS = new Set<string>();
const MEASURES = new Set<string>();

let sequence = 0;

const round = (value: number) => Number(value.toFixed(3));

export const PERF_METRIC_NAMES = {
  allureTotal: "allure.total",
  restoreStateTotal: "restoreState.total",
  restoreStateDump: "restoreState.dump",
  restoreStateAttachments: "restoreState.attachments",
  restoreStateStoreRestore: "restoreState.storeRestore",
  generateTotal: "generate.total",
  generateReadResults: "generate.readResults",
  generateReadResultsXcresultCheck: "generate.readResults.xcresultCheck",
  generateReadResultsReaddir: "generate.readResults.readdir",
  generateReadResultsFiles: "generate.readResults.files",
  generateReadResultsRealpath: "generate.readResults.realpath",
  generateReadResultsReaderRead: "generate.readResults.reader.read",
  generatePluginsDone: "generate.plugins.done",
  storeVisitTestResultConvert: "store.visitTestResult.convert",
  storeVisitTestResultDefaultLabels: "store.visitTestResult.defaultLabels",
  storeVisitTestResultEnvironment: "store.visitTestResult.environment",
  storeVisitTestResultRetry: "store.visitTestResult.retry",
  storeVisitTestResultHistory: "store.visitTestResult.history",
  storeVisitTestResultResolution: "store.visitTestResult.resolution",
  storeVisitTestResultIndexes: "store.visitTestResult.indexes",
  storeVisitAttachmentFileMetadata: "store.visitAttachmentFile.metadata",
  publishUploadTotal: "publish.upload.total",
  summaryGenerate: "summary.generate",
} as const;

export const PERF_METRIC_PREFIXES = {
  generatePlugin: "generate.plugin.",
  generatePluginDone: "generate.plugin.done.",
  publishUploadPlugin: "publish.upload.plugin.",
} as const;

const getCoveredTiming = (): { startTimeMs: number; stopTimeMs: number; durationMs: number } | undefined => {
  const timings = [
    ...SPANS.map(({ startTimeMs, durationMs }) => ({
      startTimeMs,
      stopTimeMs: startTimeMs + durationMs,
    })),
    ...AGGREGATES.values(),
    ...COUNTERS.values(),
  ];

  if (timings.length === 0) {
    return undefined;
  }

  const startTimeMs = Math.min(...timings.map(({ startTimeMs }) => startTimeMs));
  const stopTimeMs = Math.max(...timings.map(({ stopTimeMs }) => stopTimeMs));

  return {
    startTimeMs,
    stopTimeMs,
    durationMs: round(stopTimeMs - startTimeMs),
  };
};

export const isPerfMetricsEnabled = () => ENABLED_VALUES.has((process.env.ALLURE_PERF_METRICS ?? "").toLowerCase());

export const startPerfSpan = (name: string): (() => void) => {
  if (!isPerfMetricsEnabled()) {
    return () => {};
  }

  const id = `${MARK_PREFIX}${sequence++}:${name}`;
  const startMark = `${id}:start`;
  const endMark = `${id}:end`;
  let ended = false;

  MARKS.add(startMark);
  MARKS.add(endMark);
  MEASURES.add(id);
  performance.mark(startMark);

  return () => {
    if (ended) {
      return;
    }

    ended = true;
    performance.mark(endMark);
    performance.measure(id, startMark, endMark);

    const entry = performance.getEntriesByName(id, "measure").at(-1);

    if (entry) {
      SPANS.push({
        name,
        startTimeMs: round(entry.startTime),
        durationMs: round(entry.duration),
      });
    }

    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(id);
    MARKS.delete(startMark);
    MARKS.delete(endMark);
    MEASURES.delete(id);
  };
};

export const measurePerf = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  if (!isPerfMetricsEnabled()) {
    return fn();
  }

  const end = startPerfSpan(name);

  try {
    return await fn();
  } finally {
    end();
  }
};

const recordPerfTiming = (name: string, durationMs: number, startTimeMs: number) => {
  if (!isPerfMetricsEnabled()) {
    return;
  }

  const current = AGGREGATES.get(name);

  if (!current) {
    AGGREGATES.set(name, {
      name,
      count: 1,
      totalMs: durationMs,
      startTimeMs,
      stopTimeMs: startTimeMs + durationMs,
    });
    return;
  }

  current.count += 1;
  current.totalMs += durationMs;
  current.startTimeMs = Math.min(current.startTimeMs, startTimeMs);
  current.stopTimeMs = Math.max(current.stopTimeMs, startTimeMs + durationMs);
};

export const measurePerfAggregate = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  if (!isPerfMetricsEnabled()) {
    return fn();
  }

  const startTimeMs = performance.now();

  try {
    return await fn();
  } finally {
    recordPerfTiming(name, performance.now() - startTimeMs, startTimeMs);
  }
};

export const measurePerfAggregateSync = <T>(name: string, fn: () => T): T => {
  if (!isPerfMetricsEnabled()) {
    return fn();
  }

  const startTimeMs = performance.now();

  try {
    return fn();
  } finally {
    recordPerfTiming(name, performance.now() - startTimeMs, startTimeMs);
  }
};

export const incrementPerfCounter = (name: string, value = 1, metadata?: PerfMetricMetadata) => {
  if (!isPerfMetricsEnabled()) {
    return;
  }

  const timeMs = performance.now();
  const current = COUNTERS.get(name);

  if (!current) {
    COUNTERS.set(name, {
      name,
      value,
      startTimeMs: timeMs,
      stopTimeMs: timeMs,
      ...(metadata ? { metadata } : {}),
    });
    return;
  }

  current.value += value;
  current.stopTimeMs = timeMs;
  current.metadata ??= metadata;
};

const metricResult = (
  key: string,
  value: number,
  startTimeMs: number,
  stopTimeMs: number,
  metadata?: PerfMetricMetadata,
): AllurePerformanceResult => ({
  id: randomUUID(),
  key,
  value: round(value),
  start: round(performance.timeOrigin + startTimeMs),
  stop: round(performance.timeOrigin + stopTimeMs),
  ...metadata,
});

export const getPerfMetricsResults = (): AllurePerformanceResult[] => {
  const coveredTiming = getCoveredTiming();
  const results: AllurePerformanceResult[] = SPANS.map((span) => ({
    id: randomUUID(),
    key: span.name,
    value: span.durationMs,
    start: round(performance.timeOrigin + span.startTimeMs),
    stop: round(performance.timeOrigin + span.startTimeMs + span.durationMs),
  }));

  if (coveredTiming) {
    results.unshift({
      id: randomUUID(),
      key: PERF_METRIC_NAMES.allureTotal,
      value: coveredTiming.durationMs,
      start: round(performance.timeOrigin + coveredTiming.startTimeMs),
      stop: round(performance.timeOrigin + coveredTiming.stopTimeMs),
    });
  }

  for (const aggregate of AGGREGATES.values()) {
    results.push(
      metricResult(`${aggregate.name}.totalMs`, aggregate.totalMs, aggregate.startTimeMs, aggregate.stopTimeMs),
      metricResult(
        `${aggregate.name}.avgMs`,
        aggregate.totalMs / aggregate.count,
        aggregate.startTimeMs,
        aggregate.stopTimeMs,
      ),
    );
  }

  for (const counter of COUNTERS.values()) {
    results.push(metricResult(counter.name, counter.value, counter.startTimeMs, counter.stopTimeMs, counter.metadata));
  }

  return results;
};

export const writePerfMetrics = async (output: string, fileName = PERF_METRICS_FILE): Promise<boolean> => {
  if (!isPerfMetricsEnabled()) {
    return false;
  }

  const results = getPerfMetricsResults();

  await mkdir(output, { recursive: true });
  await writeFile(join(output, fileName), `${JSON.stringify(results, null, 2)}\n`, "utf8");
  resetPerfMetrics();

  return true;
};

export const resetPerfMetrics = () => {
  SPANS.length = 0;
  AGGREGATES.clear();
  COUNTERS.clear();
  sequence = 0;

  for (const mark of MARKS) {
    performance.clearMarks(mark);
  }

  for (const measure of MEASURES) {
    performance.clearMeasures(measure);
  }

  MARKS.clear();
  MEASURES.clear();
};
