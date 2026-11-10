export type MetricBetter = "lower" | "higher" | "neutral";

export interface PerformanceGroupConfig {
  title: string;
}

export interface PerformanceMetricConfig {
  title: string;
  unit: string;
  better: Exclude<MetricBetter, "neutral">;
  group?: string;
  /** Exact metric key of the configured parent; not a relationship between individual calls. */
  parent?: string;
}

export interface PerformanceConfig {
  groups?: Record<string, PerformanceGroupConfig>;
  metrics?: Record<string, PerformanceMetricConfig>;
}

export interface AllurePerformanceResult {
  /**
   * Stable result identifier used to preserve metric history across reports.
   */
  id: string;
  key: string;
  value: any;
  start: number;
  stop: number;
}

export interface MetricSample extends AllurePerformanceResult {
  value: number;
  source?: string;
  title?: string;
  unit?: string;
  group?: string;
  groupTitle?: string;
  better?: MetricBetter;
}

/** A hierarchy of metric keys, without interpreting or aggregating their values. */
export interface MetricHierarchyNode {
  key: string;
  children: MetricHierarchyNode[];
}

export const buildMetricHierarchy = (performance: PerformanceConfig = {}): MetricHierarchyNode[] => {
  const definitions = performance.metrics ?? {};
  const metrics = Object.keys(definitions)
    .sort()
    .map((key) => ({ key, parent: definitions[key]?.parent }));
  for (const { key, parent } of metrics) {
    if (parent === undefined) continue;
    if (typeof parent !== "string" || parent.length === 0) {
      throw new Error(`performance.metrics[${JSON.stringify(key)}].parent must be a non-empty metric key`);
    }
    if (parent === key) {
      throw new Error(`Performance metric ${JSON.stringify(key)} cannot be its own parent`);
    }
    if (!Object.hasOwn(definitions, parent)) {
      throw new Error(`Unknown parent ${JSON.stringify(parent)} for performance metric ${JSON.stringify(key)}`);
    }
  }
  const nodes = new Map<string, MetricHierarchyNode>(metrics.map(({ key }) => [key, { key, children: [] }]));
  const roots: MetricHierarchyNode[] = [];

  for (const { key, parent } of metrics) {
    const node = nodes.get(key)!;
    const parentNode = parent === undefined ? undefined : nodes.get(parent);
    if (parentNode) parentNode.children.push(node);
    else roots.push(node);
  }

  // Each key has at most one parent. Nodes unreachable from a root belong to a cyclic component.
  const reachable = [...roots];
  for (const node of reachable) {
    for (const child of node.children) reachable.push(child);
  }
  if (reachable.length !== nodes.size) {
    const visited = new Set(reachable.map(({ key }) => key));
    const cyclic = [...nodes.keys()].filter((key) => !visited.has(key));
    throw new Error(`Cyclic performance metric parents: ${cyclic.map((key) => JSON.stringify(key)).join(", ")}`);
  }

  return roots;
};

export const validatePerformanceConfig = (performance: PerformanceConfig = {}): void => {
  buildMetricHierarchy(performance);
};

export type ResolvableMetric = AllurePerformanceResult &
  Partial<Pick<MetricSample, "source" | "title" | "unit" | "group" | "groupTitle" | "better">>;

const isValidMetricResult = (metric: ResolvableMetric) =>
  typeof metric.id === "string" &&
  metric.id !== "" &&
  typeof metric.key === "string" &&
  metric.key !== "" &&
  Number.isFinite(metric.start) &&
  Number.isFinite(metric.stop);

export const resolveMetricSamples = (
  metrics: readonly ResolvableMetric[],
  performance: PerformanceConfig = {},
): MetricSample[] => {
  const metricsConfig = performance.metrics ?? {};
  const groupsConfig = performance.groups ?? {};

  return metrics.reduce<MetricSample[]>((acc, metric) => {
    const value = Number.isFinite(metric.value) ? Number(metric.value) : undefined;

    if (value === undefined || !isValidMetricResult(metric)) {
      return acc;
    }

    const metricConfig = Object.hasOwn(metricsConfig, metric.key) ? metricsConfig[metric.key] : undefined;
    const group = metricConfig?.group ?? metric.group;
    const groupConfig = group && Object.hasOwn(groupsConfig, group) ? groupsConfig[group] : undefined;

    acc.push({
      ...metric,
      value,
      ...(metricConfig?.title ? { title: metricConfig.title } : {}),
      ...(metricConfig?.unit ? { unit: metricConfig.unit } : {}),
      ...(group ? { group } : {}),
      ...(groupConfig?.title ? { groupTitle: groupConfig.title } : {}),
      ...(metricConfig?.better ? { better: metricConfig.better } : {}),
    });

    return acc;
  }, []);
};
