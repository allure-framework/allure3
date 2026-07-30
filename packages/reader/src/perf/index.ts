import type { MetricBetter, MetricSample } from "@allurereport/core-api";
import type { RawGlobals, ResultsReader } from "@allurereport/reader-api";

const readerId = "perf";
const legacyFiles = new Set(["perf.json", "allure-perf-metrics.json"]);
const metricBetterValues = new Set<MetricBetter>(["lower", "higher", "neutral"]);
const perfHooksFields = ["count", "totalMs", "minMs", "maxMs", "avgMs"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSupportedFile = (fileName: string) =>
  fileName === "performance.json" || fileName.endsWith("-perf.json") || legacyFiles.has(fileName);

const metricId = (source: string, key: string, index: number) => `${source}:${key}:${index}`;

const finiteNumber = (value: unknown): number | undefined => (Number.isFinite(value) ? Number(value) : undefined);

const normalizeMetric = (
  sample: Record<string, unknown>,
  source: string,
  index: number,
  defaults: Partial<Pick<MetricSample, "unit" | "group" | "better">> = {},
): MetricSample | undefined => {
  const key = typeof sample.key === "string" ? sample.key.trim() : "";
  const value = finiteNumber(sample.value);

  if (!key || value === undefined) {
    return undefined;
  }

  const start = finiteNumber(sample.start) ?? finiteNumber(sample.timestamp) ?? 0;
  const stop = finiteNumber(sample.stop) ?? start;
  const id = typeof sample.id === "string" && sample.id.trim() ? sample.id.trim() : metricId(source, key, index);
  const title = typeof sample.title === "string" && sample.title.trim() ? sample.title.trim() : undefined;
  const legacyName = typeof sample.name === "string" && sample.name.trim() ? sample.name.trim() : undefined;
  const unit = typeof sample.unit === "string" && sample.unit.trim() ? sample.unit.trim() : defaults.unit;
  const group = typeof sample.group === "string" && sample.group.trim() ? sample.group.trim() : defaults.group;
  const rawBetter = sample.better;
  const better = metricBetterValues.has(rawBetter as MetricBetter) ? (rawBetter as MetricBetter) : defaults.better;

  return {
    id,
    key,
    value,
    start,
    stop,
    source,
    ...((title ?? legacyName) ? { title: title ?? legacyName } : {}),
    ...(unit ? { unit } : {}),
    ...(group ? { group } : {}),
    ...(better ? { better } : {}),
  };
};

const metricsFromPerformanceResults = (payload: unknown, source: string): MetricSample[] | undefined => {
  const results = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.results)
      ? payload.results
      : undefined;

  if (!results) {
    return undefined;
  }

  return results
    .filter(isRecord)
    .map((result, index) => normalizeMetric(result, source, index))
    .filter((metric): metric is MetricSample => Boolean(metric));
};

const metricsFromExplicitPayload = (payload: Record<string, unknown>, source: string): MetricSample[] | undefined => {
  if (!Array.isArray(payload.metrics)) {
    return undefined;
  }

  const defaultGroup = typeof payload.name === "string" ? payload.name : undefined;

  return payload.metrics
    .filter(isRecord)
    .map((metric, index) => normalizeMetric(metric, source, index, { group: defaultGroup }))
    .filter((metric): metric is MetricSample => Boolean(metric));
};

const metricsFromPerfHooksPayload = (payload: Record<string, unknown>, source: string): MetricSample[] | undefined => {
  if (!Array.isArray(payload.summary)) {
    return undefined;
  }

  const metrics: MetricSample[] = [];

  payload.summary.filter(isRecord).forEach((summary) => {
    const name = typeof summary.name === "string" ? summary.name : undefined;

    if (!name) {
      return;
    }

    for (const field of perfHooksFields) {
      const value = summary[field];

      if (!Number.isFinite(value)) {
        continue;
      }

      const key = `${name}.${field}`;
      const metric = normalizeMetric(
        {
          key,
          value,
          title: `${name} ${field}`,
        },
        source,
        metrics.length,
        {
          unit: field === "count" ? "count" : "ms",
          better: field === "count" ? "neutral" : "lower",
        },
      );

      if (metric) {
        metrics.push(metric);
      }
    }
  });

  return metrics;
};

const flattenNumericLeaves = (value: unknown, source: string, prefix = ""): MetricSample[] => {
  if (Number.isFinite(value)) {
    const metric = normalizeMetric({ key: prefix, value }, source, 0);

    return metric ? [metric] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      flattenNumericLeaves(item, source, prefix ? `${prefix}.${index}` : `${index}`),
    );
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenNumericLeaves(child, source, prefix ? `${prefix}.${key}` : key),
    );
  }

  return [];
};

const rawAttachmentGlobals = (data: {
  getOriginalFileName: () => string;
  getContentType: () => string | undefined;
}): RawGlobals => {
  const originalFileName = data.getOriginalFileName();

  return {
    errors: [],
    attachments: [
      {
        type: "attachment",
        name: originalFileName,
        originalFileName,
        contentType: data.getContentType() ?? "application/json",
      },
    ],
  };
};

export const perf: ResultsReader = {
  matches: (data) => isSupportedFile(data.getOriginalFileName()),
  read: async (visitor, data) => {
    const originalFileName = data.getOriginalFileName();
    const payload = await data.asJson<unknown>();

    const metrics =
      metricsFromPerformanceResults(payload, originalFileName) ??
      (isRecord(payload)
        ? (metricsFromExplicitPayload(payload, originalFileName) ??
          metricsFromPerfHooksPayload(payload, originalFileName) ??
          (legacyFiles.has(originalFileName) ? flattenNumericLeaves(payload, originalFileName) : []))
        : []);

    if (metrics.length === 0) {
      return false;
    }

    await visitor.visitAttachmentFile(data, { readerId });
    await visitor.visitGlobals(rawAttachmentGlobals(data), { readerId });
    await visitor.visitMetrics(metrics, { readerId, metadata: { originalFileName } });

    return true;
  },
  readerId: () => readerId,
};
