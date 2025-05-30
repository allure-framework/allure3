import type { RecursiveTree } from "@allurereport/web-components/global";
import type { AwesomeTreeLeaf } from "types";

export const createLeafLocalizer =
  (t: (data: string) => string) =>
  (leaf: AwesomeTreeLeaf): AwesomeTreeLeaf => ({
    ...leaf,
    transitionText: t(leaf.transition),
  });

export const createTreeLocalizer =
  (t: (data: string) => string) =>
  (tree: RecursiveTree): RecursiveTree => ({
    ...tree,
    leaves: tree.leaves.length ? tree.leaves.map(createLeafLocalizer(t)) : tree.leaves,
    trees: tree.trees.length ? tree.trees.map(createTreeLocalizer(t)) : tree.trees,
  });
