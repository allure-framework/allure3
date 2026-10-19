import type { TreeMapNode } from "@allurereport/charts-api";
import type { TreeData, TreeGroup, TreeLeaf, WithChildren } from "@allurereport/core-api";

/**
 * Convert TreeData structure to TreeMapNode structure
 * Generic function that works with any TreeData<L, G> and converts it to TreeMapNode
 */
export const convertTreeDataToTreeMapNode = <T extends TreeMapNode, L, G>(
  treeData: TreeData<L, G>,
  transform: (treeDataNode: TreeLeaf<L> | TreeGroup<G>, isGroup: boolean, parentNode?: TreeGroup<G>) => T,
  transformRoot: (root: WithChildren) => T = () =>
    ({
      id: "root",
      value: undefined,
    }) as T,
): T => {
  const { root, leavesById, groupsById } = treeData;

  const convertNode = (nodeId: string, parentGroup: TreeGroup<G>, isGroup: boolean): T | null => {
    const node = isGroup ? groupsById[nodeId] : leavesById[nodeId];
    if (!node) {
      return null;
    }

    const treeMapNode: T = transform(node, isGroup, parentGroup);

    // Add children if it's a group
    if (isGroup) {
      const group = node as TreeGroup<G>;
      const children: T[] = [];

      // Add child groups
      if (group.groups) {
        group.groups.forEach((groupId) => {
          const childNode = convertNode(groupId, group, true);
          if (childNode) {
            children.push(childNode);
          }
        });
      }

      // Add child leaves
      if (group.leaves) {
        group.leaves.forEach((leafId) => {
          const childNode = convertNode(leafId, group, false);
          if (childNode) {
            children.push(childNode);
          }
        });
      }

      if (children.length === 0) {
        return null;
      }

      treeMapNode.children = children;
    }

    return treeMapNode;
  };

  // Start from root and convert all groups
  const rootChildren: T[] = [];

  if (root.groups) {
    root.groups.forEach((groupId) => {
      const childNode = convertNode(groupId, root as TreeGroup<G>, true);
      if (childNode) {
        rootChildren.push(childNode);
      }
    });
  }

  if (root.leaves) {
    root.leaves.forEach((leafId) => {
      const childNode = convertNode(leafId, root as TreeGroup<G>, false);
      if (childNode) {
        rootChildren.push(childNode);
      }
    });
  }

  return {
    children: rootChildren.length > 0 ? rootChildren : undefined,
    ...transformRoot(root),
  };
};

export const transformTreeMapNode = <T extends TreeMapNode>(tree: T, transform: (node: T) => T): T => {
  const transformedNode = transform(tree);

  if (transformedNode.children) {
    const transformedChildren = transformedNode.children.map((child) => transformTreeMapNode(child as T, transform));

    return {
      ...transformedNode,
      children: transformedChildren,
    } as T;
  }

  return transformedNode;
};
