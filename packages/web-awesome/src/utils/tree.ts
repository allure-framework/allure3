import type { RecursiveTree } from "@allurereport/web-components/global";
import type { AwesomeTreeLeaf } from "types";

type Localizer = (data: string) => string;

type Localizers = {
  value: Localizer;
  tooltip: Localizer;
};

export const createLeafLocalizer =
  (t: Localizers) =>
  (leaf: AwesomeTreeLeaf): AwesomeTreeLeaf => ({
    ...leaf,
    transitionText: t.value(leaf.transition),
    transitionTooltip: t.tooltip(leaf.transition),
  });

export const createTreeLocalizer =
  (t: Localizers) =>
  (tree: RecursiveTree): RecursiveTree => ({
    ...tree,
    leaves: tree.leaves.length ? tree.leaves.map(createLeafLocalizer(t)) : tree.leaves,
    trees: tree.trees.length ? tree.trees.map(createTreeLocalizer(t)) : tree.trees,
  });
