import type { MetricBetter, MetricSample } from "@allurereport/core-api";
import type { RawGlobals, ResultsReader } from "@allurereport/reader-api";

const readerId = "perf";
const supportedFiles = new Set(["perf.json", "allure-perf-metrics.json"]);
const metricBetterValues = new Set<MetricBetter>(["lower", "higher", "neutral"]);
const perfHooksFields = ["count", "totalMs", "minMs", "maxMs", "avgMs"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMetricSample = (value: unknown): value is MetricSample =>
  isRecord(value) && typeof value.key === "string" && Number.isFinite(value.value);

const inferUnit = (key: string): string | undefined => {
  const normalized = key.toLowerCase();

  if (normalized.endsWith("ms")) {
    return "ms";
  }

  if (normalized.endsWith("sec") || normalized.endsWith("seconds")) {
    return "s";
  }

  if (normalized.endsWith("mb")) {
    return "MB";
  }

  if (normalized.endsWith("bytes")) {
    return "bytes";
  }

  if (normalized.endsWith("count")) {
    return "count";
  }

  return undefined;
};

const normalizeTags = (tags: unknown): Record<string, string> | undefined => {
  if (!isRecord(tags)) {
    return undefined;
  }

  const entries = Object.entries(tags)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => [key, value as string]);

  return entries.length ? Object.fromEntries(entries) : undefined;
};

const normalizeDisplay = (display: unknown): MetricSample["display"] | undefined => {
  if (!isRecord(display) || display.history !== true) {
    return undefined;
  }

  return { history: true };
};

const normalizeMetric = (sample: MetricSample, fallbackSource: string): MetricSample => {
  const key = sample.key.trim();
  const unit = typeof sample.unit === "string" && sample.unit.trim() ? sample.unit.trim() : inferUnit(key);
  const name = typeof sample.name === "string" ? sample.name.trim() : "";
  const group = typeof sample.group === "string" ? sample.group.trim() : "";
  const source = typeof sample.source === "string" && sample.source.trim() ? sample.source.trim() : fallbackSource;
  const tags = normalizeTags(sample.tags);
  const better = metricBetterValues.has(sample.better as MetricBetter) ? sample.better : undefined;
  const display = normalizeDisplay(sample.display);

  return {
    key,
    value: Number(sample.value),
    ...(unit ? { unit } : {}),
    ...(name ? { name } : {}),
    ...(group ? { group } : {}),
    ...(Number.isFinite(sample.timestamp) ? { timestamp: sample.timestamp } : {}),
    ...(tags ? { tags } : {}),
    source,
    ...(better ? { better } : {}),
    ...(display ? { display } : {}),
  };
};

const displayHistoryMetricKey = (payload: Record<string, unknown>): string | undefined => {
  const display = payload.display;

  if (!isRecord(display) || typeof display.historyMetricKey !== "string") {
    return undefined;
  }

  const key = display.historyMetricKey.trim();

  return key || undefined;
};

const applyDisplayConfig = (metrics: MetricSample[], payload: Record<string, unknown>): MetricSample[] => {
  const historyMetricKey = displayHistoryMetricKey(payload);

  if (!historyMetricKey) {
    return metrics;
  }

  return metrics.map((metric) =>
    metric.key === historyMetricKey ? { ...metric, display: { ...metric.display, history: true } } : metric,
  );
};

const metricsFromExplicitPayload = (payload: Record<string, unknown>, source: string): MetricSample[] | undefined => {
  if (!Array.isArray(payload.metrics)) {
    return undefined;
  }

  const defaultGroup = typeof payload.name === "string" ? payload.name : undefined;

  return payload.metrics
    .filter(isMetricSample)
    .map((metric) =>
      normalizeMetric(
        {
          ...metric,
          group: metric.group ?? defaultGroup,
        },
        source,
      ),
    )
    .filter(({ key }) => key.length > 0);
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

      metrics.push(
        normalizeMetric(
          {
            key,
            value: value as number,
            unit: field === "count" ? "count" : "ms",
            name: `${name} ${field}`,
            source,
            better: field === "count" ? "neutral" : "lower",
          },
          source,
        ),
      );
    }
  });

  return metrics;
};

const flattenNumericLeaves = (value: unknown, source: string, prefix = ""): MetricSample[] => {
  if (Number.isFinite(value)) {
    return [
      normalizeMetric(
        {
          key: prefix,
          value: value as number,
        },
        source,
      ),
    ].filter(({ key }) => key.length > 0);
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
  matches: (data) => supportedFiles.has(data.getOriginalFileName()),
  read: async (visitor, data) => {
    const originalFileName = data.getOriginalFileName();
    const payload = await data.asJson<unknown>();

    if (!isRecord(payload)) {
      return false;
    }

    const metrics = applyDisplayConfig(
      metricsFromExplicitPayload(payload, originalFileName) ??
        metricsFromPerfHooksPayload(payload, originalFileName) ??
        flattenNumericLeaves(payload, originalFileName),
      payload,
    );

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
