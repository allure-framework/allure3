import type { FlatTreeNode, MoveDirection, MoveFocusResult } from "./types.js";

const findIndex = (flatList: FlatTreeNode[], currentId: string | undefined): number => {
  if (!currentId) {
    return -1;
  }

  return flatList.findIndex((node) => node.id === currentId);
};

const findParent = (flatList: FlatTreeNode[], node: FlatTreeNode): FlatTreeNode | undefined => {
  if (!node.parentId) {
    return undefined;
  }

  return flatList.find((candidate) => candidate.id === node.parentId || candidate.nodeId === node.parentId);
};

export const moveFocus = (
  flatList: FlatTreeNode[],
  currentId: string | undefined,
  direction: MoveDirection,
): MoveFocusResult => {
  if (flatList.length === 0) {
    return { nextId: undefined };
  }

  const currentIndex = findIndex(flatList, currentId);
  const current = currentIndex >= 0 ? flatList[currentIndex] : undefined;

  switch (direction) {
    case "up": {
      if (currentIndex <= 0) {
        return { nextId: flatList[0]?.id };
      }

      if (!current) {
        return { nextId: flatList[currentIndex - 1]?.id };
      }

      for (let index = currentIndex - 1; index >= 0; index--) {
        const candidate = flatList[index]!;

        if (current.parentId && candidate.id === current.parentId) {
          for (let nestedIndex = currentIndex - 1; nestedIndex > index; nestedIndex--) {
            const nested = flatList[nestedIndex]!;

            if (nested.depth > candidate.depth) {
              return { nextId: nested.id };
            }
          }

          return { nextId: candidate.id };
        }

        return { nextId: candidate.id };
      }

      return { nextId: flatList[0]?.id };
    }

    case "down": {
      if (currentIndex < 0) {
        return { nextId: flatList[0]?.id };
      }

      if (currentIndex >= flatList.length - 1) {
        return { nextId: flatList[flatList.length - 1]?.id };
      }

      return { nextId: flatList[currentIndex + 1]?.id };
    }

    case "home": {
      return { nextId: flatList[0]?.id };
    }

    case "end": {
      return { nextId: flatList[flatList.length - 1]?.id };
    }

    case "firstLeaf": {
      const firstLeaf = flatList.find((node) => node.kind === "leaf");

      return { nextId: firstLeaf?.id ?? flatList[0]?.id };
    }

    case "lastLeaf": {
      const leaves = flatList.filter((node) => node.kind === "leaf");
      const lastLeaf = leaves[leaves.length - 1];

      return { nextId: lastLeaf?.id ?? flatList[flatList.length - 1]?.id };
    }

    case "parent": {
      if (!current) {
        return { nextId: flatList[0]?.id };
      }

      const parent = findParent(flatList, current);

      return { nextId: parent?.id ?? current.id };
    }

    case "left": {
      if (!current) {
        return { nextId: flatList[0]?.id };
      }

      if ((current.kind === "group" || current.kind === "env") && current.isExpanded) {
        return { nextId: current.id, collapse: true };
      }

      const parent = findParent(flatList, current);

      if (parent) {
        return { nextId: parent.id };
      }

      if (currentIndex > 0) {
        return { nextId: flatList[currentIndex - 1]?.id };
      }

      return { nextId: current.id };
    }

    case "firstChild":
    case "right": {
      if (!current) {
        return { nextId: flatList[0]?.id };
      }

      if ((current.kind === "group" || current.kind === "env") && !current.isExpanded) {
        return { nextId: current.id, expand: true };
      }

      const nextNode = flatList[currentIndex + 1];

      if (nextNode && nextNode.depth > current.depth) {
        return { nextId: nextNode.id };
      }

      if (direction === "right" && currentIndex < flatList.length - 1) {
        return { nextId: flatList[currentIndex + 1]?.id };
      }

      return { nextId: current.id };
    }

    default: {
      return { nextId: current?.id ?? flatList[0]?.id };
    }
  }
};
