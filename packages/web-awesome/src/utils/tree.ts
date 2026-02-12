import type { RecursiveTree } from "@allurereport/web-components/global";
import type { AwesomeTreeLeaf } from "types";

type Localizer = (data: string, params?: Record<string, unknown>) => string;

type Localizers = {
  tooltip: Localizer;
};

export const createLeafLocalizer =
  (t: Localizers) =>
  (leaf: AwesomeTreeLeaf): AwesomeTreeLeaf => {
    const tooltips = {
      transition: t.tooltip(leaf.transition),
      flaky: leaf.flaky && t.tooltip("flaky"),
      retries: leaf.retriesCount && t.tooltip("retries", { count: leaf.retriesCount }),
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
