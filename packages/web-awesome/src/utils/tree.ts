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
  (tree: RecursiveTree | null | undefined): RecursiveTree | null => {
    if (!tree) return null;
    const leaves = tree.leaves ?? [];
    const trees = tree.trees ?? [];
    return {
      ...tree,
      leaves: leaves.length ? leaves.map(createLeafLocalizer(t)) : leaves,
      trees: trees.length ? trees.map(createTreeLocalizer(t)) : trees,
    };
  };
