import {
  type Comparator,
  type DefaultTreeGroup,
  type DefaultTreeLeaf,
  type TestResult,
  type TreeData,
  type TreeGroup,
  type TreeLeaf,
  type WithChildren,
  findByLabelName,
  reverse,
} from "@allurereport/core-api";
import { emptyStatistic, incrementStatistic } from "@allurereport/core-api";
import { md5 } from "./misc.js";

const addLeaf = (node: WithChildren, nodeId: string) => {
  if (node.leaves === undefined) {
    node.leaves = [];
  }
  if (node.leaves.find((value) => value === nodeId)) {
    return;
  }
  node.leaves.push(nodeId);
};

const addGroup = (node: WithChildren, nodeId: string) => {
  if (node.groups === undefined) {
    node.groups = [];
  }
  if (node.groups.find((value) => value === nodeId)) {
    return;
  }
  node.groups.push(nodeId);
};

const createTree = <T, L, G>(
  data: T[],
  classifier: (item: T) => string[][],
  leafFactory: (item: T) => TreeLeaf<L>,
  groupFactory: (parentGroup: string | undefined, groupClassifier: string) => TreeGroup<G>,
  addLeafToGroup: (group: TreeGroup<G>, leaf: TreeLeaf<L>) => void = () => {},
): TreeData<L, G> => {
  const groupsByClassifier: Record<string, Record<string, TreeGroup<G>>> = {};
  const leavesById: Record<string, TreeLeaf<L>> = {};
  const groupsById: Record<string, TreeGroup<G>> = {};
  const root: WithChildren = { groups: [], leaves: [] };

  for (const item of data) {
    const leaf = leafFactory(item);

    leavesById[leaf.nodeId] = leaf;

    const itemGroups = classifier(item);
    let parentGroups = [root];

    for (const layer of itemGroups) {
      if (layer.length === 0) {
        break;
      }

      parentGroups = layer.flatMap((group) => {
        return parentGroups.map((parentGroup) => {
          const parentId = "nodeId" in parentGroup ? (parentGroup.nodeId as string) : "";

          if (groupsByClassifier[parentId] === undefined) {
            groupsByClassifier[parentId] = {};
          }

          if (groupsByClassifier[parentId][group] === undefined) {
            const newGroup = groupFactory(parentId, group);

            groupsByClassifier[parentId][group] = newGroup;
            groupsById[newGroup.nodeId] = newGroup;
          }

          const currentGroup = groupsByClassifier[parentId][group];

          addGroup(parentGroup, currentGroup.nodeId);
          addLeafToGroup(currentGroup, leaf);

          return currentGroup;
        });
      });
    }

    parentGroups.forEach((parentGroup) => addLeaf(parentGroup, leaf.nodeId));
  }

  // TODO: iterate over groupsById to sort leaves by start here?

  return {
    root,
    groupsById,
    leavesById,
  };
};

export const byLabels = (item: TestResult, labelNames: string[]): string[][] => {
  return labelNames.map(
    (labelName) =>
      item.labels.filter((label) => labelName === label.name).map((label) => label.value ?? "__unknown") ?? [],
  );
};

export const filterTreeLabels = (data: TestResult[], labelNames: string[]) => {
  return [...labelNames]
    .reverse()
    .filter((labelName) => data.find((item) => findByLabelName(item.labels, labelName)))
    .reverse();
};

export const createTreeByLabels = (data: TestResult[], labelNames: string[]) => {
  return createTree<TestResult, DefaultTreeLeaf, DefaultTreeGroup>(
    data,
    (item) => byLabels(item, labelNames),
    ({ id, name, status, duration, flaky, start }) => ({
      nodeId: id,
      name,
      status,
      duration,
      flaky,
      start,
    }),
    (parentId, groupClassifier) => ({
      nodeId: md5((parentId ? `${parentId}.` : "") + groupClassifier),
      name: groupClassifier,
      statistic: emptyStatistic(),
    }),
    (group, leaf) => {
      incrementStatistic(group.statistic, leaf.status);
    },
  );
};

/**
 * Mutates the given tree by filtering leaves in each group.
 * Returns the link to the same tree.
 * @param tree
 * @param predicate
 */
export const filterTree = <L, G>(tree: TreeData<L, G>, predicate: (leaf: TreeLeaf<L>) => boolean) => {
  const visitedGroups = new Set<string>();
  const { root, leavesById, groupsById } = tree;
  const filterGroupLeaves = (group: TreeGroup<G>) => {
    if (!predicate) {
      return group;
    }

    if (group.groups?.length) {
      group.groups.forEach((groupId) => {
        const subGroup = groupsById[groupId];

        if (!subGroup || visitedGroups.has(groupId)) {
          return;
        }

        filterGroupLeaves(subGroup);
        visitedGroups.add(groupId);
      });
    }

    if (group.leaves?.length) {
      group.leaves = group.leaves.filter((leaveId) => predicate(leavesById[leaveId]));
    }

    return group;
  };

  filterGroupLeaves(root as TreeGroup<G>);

  return tree;
};

/**
 * Mutates the given tree by sorting leaves in each group.
 * Returns the link to the same tree.
 * @param tree
 * @param comparator
 */
export const sortTree = <L, G>(tree: TreeData<L, G>, comparator: Comparator<TreeLeaf<L>>) => {
  const visitedGroups = new Set<string>();
  const { root, leavesById, groupsById } = tree;
  const sortGroupLeaves = (group: TreeGroup<G>) => {
    if (!comparator) {
      return group;
    }

    if (group.groups?.length) {
      group.groups.forEach((groupId) => {
        if (visitedGroups.has(groupId)) {
          return;
        }

        sortGroupLeaves(groupsById[groupId]);
        visitedGroups.add(groupId);
      });
    }

    if (group.leaves?.length) {
      group.leaves = group.leaves.sort((a, b) => {
        const leafA = leavesById[a];
        const leafB = leavesById[b];

        return comparator(leafA, leafB);
      });
    }

    return group;
  };

  sortGroupLeaves(root as TreeGroup<G>);

  return tree;
};

/**
 * Mutates the given tree by applying the transformer function to each leaf.
 * Returns the link to the same tree.
 * @param tree
 * @param transformer
 */
export const transformTree = <L, G>(
  tree: TreeData<L, G>,
  transformer: (leaf: TreeLeaf<L>, idx: number) => TreeLeaf<L>,
) => {
  const visitedGroups = new Set<string>();
  const { root, leavesById, groupsById } = tree;
  const transformGroupLeaves = (group: TreeGroup<G>) => {
    if (!transformer) {
      return group;
    }

    if (group.groups?.length) {
      group.groups.forEach((groupId) => {
        if (visitedGroups.has(groupId)) {
          return;
        }

        transformGroupLeaves(groupsById[groupId]);
        visitedGroups.add(groupId);
      });
    }

    if (group.leaves?.length) {
      group.leaves.forEach((leaf, i) => {
        leavesById[leaf] = transformer(leavesById[leaf], i);
      });
    }

    return group;
  };

  transformGroupLeaves(root as TreeGroup<G>);

  return tree;
};
