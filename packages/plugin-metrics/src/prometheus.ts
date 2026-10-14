import type { MetricLine } from "./model.js";
import { normalize } from "./utils.js";

// Prometheus accepts `[a-zA-Z_:][a-zA-Z0-9_:]*` only. Allure 2 left category names as is, which produced
// files Prometheus rejects, so everything else is replaced additionally.
const metricName = (name: string, key: string): string =>
  `${name}_${normalize(key)}`.replace(/[^a-zA-Z0-9_:]/g, "_").replace(/^(\d)/, "_$1");

const labelName = (name: string): string => name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^(\d)/, "_$1");

const escapeLabelValue = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');

export const renderLabels = (labels?: string | Record<string, string>): string => {
  if (typeof labels === "string") {
    return labels.trim() === "" ? "" : `{${labels}}`;
  }

  const entries = Object.entries(labels ?? {});

  if (entries.length === 0) {
    return "";
  }

  return `{${entries.map(([key, value]) => `${labelName(key)}="${escapeLabelValue(String(value))}"`).join(",")}}`;
};

/** Same line layout as Allure 2: `<name>_<key>{<labels>} <value>` */
export const renderPrometheus = (lines: MetricLine[], labels?: string | Record<string, string>): string => {
  const renderedLabels = renderLabels(labels);
  // different keys (e.g. category names) may collapse into the same metric name after sanitizing, and
  // Prometheus rejects duplicated series, so such values are summed up
  const values = new Map<string, number>();

  for (const { name, key, value } of lines) {
    const metric = metricName(name, key);

    values.set(metric, (values.get(metric) ?? 0) + value);
  }

  return [...values].map(([metric, value]) => `${metric}${renderedLabels} ${value}`).join("\n") + "\n";
};

/** Prometheus labels from the `ALLURE_PROMETHEUS_LABELS` (or `allure.prometheus.labels`) environment variable */
export const labelsFromEnv = (env: NodeJS.ProcessEnv = process.env): string | undefined =>
  env.ALLURE_PROMETHEUS_LABELS ?? env["allure.prometheus.labels"];
