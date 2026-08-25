import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import type { AllurePerformanceResult, PerformanceConfig } from "@allurereport/core-api";

export const PERF_METRICS_FILE = "performance.json";
export const perfMetricsFileName = (reportUuid: string) => `${reportUuid}-perf.json`;

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
  results: AllurePerformanceResult[];
};

const MARK_PREFIX = "allure:perf:";
const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const SPANS: PerfMetricSpan[] = [];
const MARKS = new Set<string>();
const MEASURES = new Set<string>();

let sequence = 0;

const round = (value: number) => Number(value.toFixed(3));

const SELF_PERF_GROUPS = {
  allure: { title: "Allure" },
  restoreState: { title: "Restore state" },
  generate: { title: "Generate" },
  publish: { title: "Publish" },
  summary: { title: "Summary" },
} satisfies NonNullable<PerformanceConfig["groups"]>;

const SELF_PERF_GROUP_KEYS = Object.keys(SELF_PERF_GROUPS);

const selfPerfGroup = (key: string) =>
  SELF_PERF_GROUP_KEYS.find((group) => key === group || key.startsWith(`${group}.`));

const selfPerfTitle = (key: string) =>
  key
    .split(".")
    .map((part, index) =>
      index === 0 ? (SELF_PERF_GROUPS[part as keyof typeof SELF_PERF_GROUPS]?.title ?? part) : part,
    )
    .join(" ");

export const getPerfMetricsPerformanceConfig = (
  payload: Pick<PerfMetricsPayload, "results">,
): PerformanceConfig | undefined => {
  if (payload.results.length === 0) {
    return undefined;
  }

  const metrics = Object.fromEntries(
    payload.results.map(({ key }) => [
      key,
      {
        title: selfPerfTitle(key),
        unit: "ms",
        better: "lower" as const,
        ...(selfPerfGroup(key) ? { group: selfPerfGroup(key)! } : {}),
      },
    ]),
  );

  return {
    groups: SELF_PERF_GROUPS,
    metrics,
  };
};

export const mergePerformanceConfig = (
  base: PerformanceConfig | undefined,
  override: PerformanceConfig | undefined,
): PerformanceConfig | undefined => {
  if (!base) {
    return override;
  }

  if (!override) {
    return base;
  }

  return {
    groups: {
      ...base.groups,
      ...override.groups,
    },
    metrics: Object.fromEntries(
      [...new Set([...Object.keys(base.metrics ?? {}), ...Object.keys(override.metrics ?? {})])].map((key) => [
        key,
        {
          ...base.metrics?.[key],
          ...override.metrics?.[key],
        },
      ]),
    ) as PerformanceConfig["metrics"],
  };
};

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
  const totalSummary = getCoveredDurationSummary();
  const results = SPANS.map((span) => ({
    id: randomUUID(),
    key: span.name,
    value: span.durationMs,
    start: round(performance.timeOrigin + span.startTimeMs),
    stop: round(performance.timeOrigin + span.startTimeMs + span.durationMs),
  }));

  if (totalSummary) {
    results.unshift({
      id: randomUUID(),
      key: PERF_METRIC_NAMES.allureTotal,
      value: totalSummary.avgMs,
      start: round(performance.timeOrigin + Math.min(...SPANS.map(({ startTimeMs }) => startTimeMs))),
      stop: round(
        performance.timeOrigin + Math.max(...SPANS.map(({ startTimeMs, durationMs }) => startTimeMs + durationMs)),
      ),
    });
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    results,
  };
};

export const writePerfMetrics = async (output: string, fileName = PERF_METRICS_FILE): Promise<boolean> => {
  if (!isPerfMetricsEnabled()) {
    return false;
  }

  const payload = getPerfMetricsPayload();

  await mkdir(output, { recursive: true });
  await writeFile(join(output, fileName), `${JSON.stringify(payload.results, null, 2)}\n`, "utf8");
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
