import { signal } from "@preact/signals";

export type TreeSwitcher = "suites" | "categories";

export const currentTree = signal<TreeSwitcher>("suites");

export const setCurrentTree = (tab: TreeSwitcher) => {
  currentTree.value = tab;
};
