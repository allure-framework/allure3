import type { ReportRecursiveTree as RecursiveTree } from "types";
import type { ReportTree, ReportTreeLeaf } from "types";

export const compactTreeGroups = (tree: RecursiveTree, groupsById: ReportTree["groupsById"]): RecursiveTree => ({
  ...tree,
  trees: tree.trees.map((group) => {
    const names = [group.name];
    let tail = group;

    while (tail.trees.length === 1) {
      const original = groupsById[tail.nodeId];

      // Filters can hide siblings. Only compact chains that exist in the original tree.
      if (original?.groups?.length !== 1 || original.leaves?.length) {
        break;
      }

      tail = tail.trees[0]!;
      names.push(tail.name);
    }

    return {
      ...compactTreeGroups(tail, groupsById),
      nodeId: group.nodeId,
      name: names.join(" > "),
    };
  }),
});

type Localizer = (data: string, params?: Record<string, string | number>) => string;

type Localizers = {
  tooltip: Localizer;
};

export const createLeafLocalizer =
  (t: Localizers) =>
  (leaf: ReportTreeLeaf): ReportTreeLeaf => {
    const tooltips = {
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
