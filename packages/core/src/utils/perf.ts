import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

export const PERF_METRICS_FILE = "allure-perf-metrics.json";

export type PerfMetricSpan = {
  name: string;
  startTimeMs: number;
  durationMs: number;
};

export type PerfMetricSummary = {
  name: string;
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
};

export type PerfMetricsPayload = {
  version: 1;
  generatedAt: string;
  timeOriginMs: number;
  spans: PerfMetricSpan[];
  summary: PerfMetricSummary[];
  display?: {
    historyMetricKey: string;
  };
};

const MARK_PREFIX = "allure:perf:";
const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const SPANS: PerfMetricSpan[] = [];
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
  generatePluginsDone: "generate.plugins.done",
  publishUploadTotal: "publish.upload.total",
  summaryGenerate: "summary.generate",
} as const;

export const PERF_METRIC_PREFIXES = {
  generatePluginDone: "generate.plugin.done.",
  publishUploadPlugin: "publish.upload.plugin.",
} as const;

const summarizeSpanGroup = (name: string, group: PerfMetricSpan[]): PerfMetricSummary => {
  const durations = group.map(({ durationMs }) => durationMs);
  const totalMs = durations.reduce((acc, duration) => acc + duration, 0);

  return {
    name,
    count: group.length,
    totalMs: round(totalMs),
    minMs: round(Math.min(...durations)),
    maxMs: round(Math.max(...durations)),
    avgMs: round(totalMs / group.length),
  };
};

const getCoveredDurationSummary = (): PerfMetricSummary | undefined => {
  if (SPANS.length === 0) {
    return undefined;
  }

  const startTimeMs = Math.min(...SPANS.map(({ startTimeMs }) => startTimeMs));
  const endTimeMs = Math.max(...SPANS.map(({ startTimeMs, durationMs }) => startTimeMs + durationMs));
  const durationMs = round(endTimeMs - startTimeMs);

  return {
    name: PERF_METRIC_NAMES.allureTotal,
    count: 1,
    totalMs: durationMs,
    minMs: durationMs,
    maxMs: durationMs,
    avgMs: durationMs,
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

export const getPerfMetricsPayload = (): PerfMetricsPayload => {
  const byName = new Map<string, PerfMetricSpan[]>();

  for (const span of SPANS) {
    const current = byName.get(span.name) ?? [];

    current.push(span);
    byName.set(span.name, current);
  }

  const totalSummary = getCoveredDurationSummary();
  const summary = [...byName.entries()].map(([name, group]) => summarizeSpanGroup(name, group));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    timeOriginMs: round(performance.timeOrigin),
    spans: [...SPANS],
    summary: totalSummary ? [totalSummary, ...summary] : summary,
    ...(totalSummary ? { display: { historyMetricKey: `${PERF_METRIC_NAMES.allureTotal}.avgMs` } } : {}),
  };
};

export const writePerfMetrics = async (output: string): Promise<boolean> => {
  if (!isPerfMetricsEnabled()) {
    return false;
  }

  const payload = getPerfMetricsPayload();

  await mkdir(output, { recursive: true });
  await writeFile(join(output, PERF_METRICS_FILE), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  resetPerfMetrics();

  return true;
};

export const resetPerfMetrics = () => {
  SPANS.length = 0;
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
