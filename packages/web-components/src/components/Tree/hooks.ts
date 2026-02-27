import { batch, useComputed, useSignal } from "@preact/signals";
import type { RecursiveTree } from "global";
import { useCallback, useEffect, useMemo } from "preact/hooks";

type TreeLeaf = RecursiveTree["leaves"][number];

export const usePaginated = <T>(items: T[], pageSize: number = 3) => {
  const localItems = useSignal(items);
  const page = useSignal(0);
  const hasNextPage = useComputed<boolean>(
    () => localItems.value.length > 0 && (page.value + 1) * pageSize < localItems.value.length,
  );
  const resultItems = useComputed<T[]>(() => localItems.value.slice(0, (page.value + 1) * pageSize));

  useEffect(() => {
    batch(() => {
      localItems.value = items;

      if (localItems.peek().length === items.length) {
        return;
      }

      // Clamp page to valid range so we keep showing as much as user had opened
      const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
      page.value = Math.min(page.peek(), maxPage);
    });
  }, [items, pageSize, localItems, page]);

  const handleNextPage = useCallback(() => {
    if (!hasNextPage.value) {
      return;
    }

    page.value++;
  }, [page, hasNextPage]);

  return [{ items: resultItems, hasNextPage: hasNextPage }, handleNextPage] as const;
};

export type TreeLeafRow = {
  type: "leaf";
  data: TreeLeaf;
  offset: number;
};

export type TreeGroupRow = {
  type: "group";
  data: RecursiveTree;
  offset: number;
};

export type TreeRow = TreeLeafRow | TreeGroupRow;

type FlattenStackItem =
  | { type: "group"; node: RecursiveTree; depth: number }
  | { type: "leaf"; leaf: TreeLeaf; depth: number };

/**
 * Flattens a tree into a list of rows using an explicit stack (no recursion).
 * Group row is always added; children are added only when the group is not collapsed.
 * Order: group first, then nested trees (depth-first), then leaves.
 * Each row has offset = nesting depth (0 for root).
 */
const flattenTree = (root: RecursiveTree, isNodeCollapsed: (node: RecursiveTree) => boolean): TreeRow[] => {
  const rows: TreeRow[] = [];
  const stack: FlattenStackItem[] = [{ type: "group", node: root, depth: 0 }];

  if (isNodeCollapsed(root)) {
    return [{ type: "group", data: root, offset: 0 }];
  }

  while (stack.length > 0) {
    const item = stack.pop()!;

    if (item.type === "group") {
      const { node, depth } = item;

      rows.push({ type: "group", data: node, offset: depth });

      if (!isNodeCollapsed(node)) {
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
    } else {
      rows.push({ type: "leaf", data: item.leaf, offset: item.depth });
    }
  }

  return rows;
};

export const useTreeRows = (tree: RecursiveTree, isNodeCollapsed: (node: RecursiveTree) => boolean): TreeRow[] => {
  return useMemo(() => flattenTree(tree, isNodeCollapsed), [tree, isNodeCollapsed]);
};
