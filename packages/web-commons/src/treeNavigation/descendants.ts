import type { FlatTreeNode } from "./types.js";

/** Visible descendants of a node in a depth-first flat list. */
export const getDescendantNodes = (flatList: FlatTreeNode[], nodeId: string): FlatTreeNode[] => {
  const index = flatList.findIndex((node) => node.id === nodeId);

  if (index < 0) {
    return [];
  }

  const parentDepth = flatList[index]!.depth;
  const descendants: FlatTreeNode[] = [];

  for (let i = index + 1; i < flatList.length; i++) {
    const node = flatList[i]!;

    if (node.depth <= parentDepth) {
      break;
    }

    descendants.push(node);
  }

  return descendants;
};

/** Expandable group/env nodes among descendants (not including the root node). */
export const getExpandableDescendants = (flatList: FlatTreeNode[], nodeId: string): FlatTreeNode[] =>
  getDescendantNodes(flatList, nodeId).filter((node) => node.kind === "group" || node.kind === "env");
