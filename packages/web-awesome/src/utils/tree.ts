import type { ReportRecursiveTree as RecursiveTree } from "types";
import type { ReportTreeLeaf } from "types";

type Localizer = (data: string, params?: Record<string, string | number>) => string;

type Localizers = {
  tooltip: Localizer;
  /**
   * Formats the start/stop pair a duration was calculated from. Formatted outside this util so a
   * localizer stays free of the locale store; omitted, the report shows durations without tooltips.
   */
  timeRange?: (start?: number, stop?: number) => string | undefined;
};

export const createLeafLocalizer =
  (t: Localizers) =>
  (leaf: ReportTreeLeaf): ReportTreeLeaf => {
    const tooltips = {
      duration: t.timeRange?.(leaf.start, leaf.stop),
      transition: leaf.transition ? t.tooltip(leaf.transition) : undefined,
      flaky: leaf.flaky ? t.tooltip("flaky") : undefined,
      retries: leaf.retriesCount ? t.tooltip("retries", { count: leaf.retriesCount }) : undefined,
      retriesStatusChange: leaf.retriesStatusChange ? t.tooltip("retriesStatusChange") : undefined,
      resolution: leaf.resolution && t.tooltip(`resolution.${leaf.resolution}`),
    };
    return {
      ...leaf,
      tooltips,
    };
  };

export const createTreeLocalizer =
  (t: Localizers) =>
  (tree: RecursiveTree): RecursiveTree => ({
    ...tree,
    leaves: tree.leaves.length ? tree.leaves.map(createLeafLocalizer(t)) : tree.leaves,
    trees: tree.trees.length ? tree.trees.map(createTreeLocalizer(t)) : tree.trees,
  });
