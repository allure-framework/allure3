import type { FlatTree, Tree, TreeGroup, TreeLeaf, TreeRow } from "./model";

type FlattenStackItem<T> =
  | { type: "group"; node: TreeGroup<T>; depth: number }
  | { type: "leaf"; leaf: TreeLeaf<T>; depth: number };

const identityFilter = () => true;

/**
 * Flattens a tree into a list of rows using an explicit stack (no recursion).
 * Group row is always added; children are added only when the group is not collapsed.
 * Order: group first, then nested trees (depth-first), then leaves.
 * Each row has offset = nesting depth (0 for root).
 */
export const flattenTree = <T>(props: {
  root: Tree<T>;
  filterGroup?: (group: TreeGroup<T>) => boolean;
}): FlatTree<T> => {
  const { root, filterGroup = identityFilter } = props;
  const rows: TreeRow<T>[] = [];
  const stack: FlattenStackItem<T>[] = [{ type: "group", node: root, depth: 0 }];

  if (!filterGroup(root)) {
    return [{ type: "group", data: root, offset: 0 }];
  }

  while (stack.length > 0) {
    const item = stack.pop()!;

    if (item.type === "leaf") {
      rows.push({ type: "leaf", data: item.leaf, offset: item.depth });
      continue;
    }

    if (item.type === "group") {
      const { node, depth } = item;

      rows.push({ type: "group", data: node, offset: depth });

      if (!filterGroup(node)) {
        continue;
      }

      const childDepth = depth + 1;
      const trees = node.trees ?? [];
      const leaves = node.leaves ?? [];

      // Push in reverse order so we process: first subtree, then next..., then leaves
      for (let i = leaves.length - 1; i >= 0; i--) {
        stack.push({ type: "leaf", leaf: leaves[i], depth: childDepth });
      }

      for (let i = trees.length - 1; i >= 0; i--) {
        stack.push({ type: "group", node: trees[i], depth: childDepth });
      }
    }
  }

  return rows;
};


export const findPreviousFocusableGroupEl = (el: HTMLElement) => {
  let currentElement = el;
  while (currentElement.previousElementSibling) {
    currentElement = currentElement.previousElementSibling as HTMLElement;

    if (currentElement.dataset.type === "group") {
      const row = currentElement.querySelector("[data-row]");

      if (row instanceof HTMLElement) {
        return row;
      }
    }
  }
};

export const findLastFocusableChildLeafEl = (el: HTMLElement) => {
  const group = findPreviousFocusableGroupEl(el);
  return group?.querySelector("[data-row]:last-child");
};
