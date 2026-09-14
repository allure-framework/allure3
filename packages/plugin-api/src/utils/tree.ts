import {
  type Comparator,
  type DefaultTreeGroup,
  type DefaultTreeLeaf,
  type TestResult,
  type TreeData,
  type TreeGroup,
  type TreeLeaf,
  type WithChildren,
} from "@allurereport/core-api";
import { emptyStatistic } from "@allurereport/core-api";

import { md5 } from "./misc.js";

const addLeaf = (childLeaves: WeakMap<WithChildren, Set<string>>, node: WithChildren, nodeId: string) => {
  if (node.leaves === undefined) {
    node.leaves = [];
  }
  let leaves = childLeaves.get(node);

  if (!leaves) {
    leaves = new Set(node.leaves);
    childLeaves.set(node, leaves);
  }

  if (leaves.has(nodeId)) {
    return;
  }
  leaves.add(nodeId);
  node.leaves.push(nodeId);
};

const addGroup = (childGroups: WeakMap<WithChildren, Set<string>>, node: WithChildren, nodeId: string) => {
  if (node.groups === undefined) {
    node.groups = [];
  }
  let groups = childGroups.get(node);

  if (!groups) {
    groups = new Set(node.groups);
    childGroups.set(node, groups);
  }

  if (groups.has(nodeId)) {
    return;
  }
  groups.add(nodeId);
  node.groups.push(nodeId);
};

const createTree = <T, L, G>(
  data: T[],
  classifier: (item: T) => string[][],
  leafFactory: (item: T) => TreeLeaf<L>,
  groupFactory: (parentGroup: string | undefined, groupClassifier: string) => TreeGroup<G>,
  addLeafToGroup: (group: TreeGroup<G>, leaf: TreeLeaf<L>) => void = () => {},
): TreeData<L, G> => {
  const groupsByClassifier = new Map<string, Map<string, TreeGroup<G>>>();
  const leavesById: Record<string, TreeLeaf<L>> = {};
  const groupsById: Record<string, TreeGroup<G>> = {};
  const childLeaves = new WeakMap<WithChildren, Set<string>>();
  const childGroups = new WeakMap<WithChildren, Set<string>>();
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

      const nextParentGroups: TreeGroup<G>[] = [];
      const nextParentGroupIds = new Set<string>();

      for (const group of layer) {
        for (const parentGroup of parentGroups) {
          const parentId = "nodeId" in parentGroup ? (parentGroup.nodeId as string) : "";
          let groupsByParent = groupsByClassifier.get(parentId);

          if (groupsByParent === undefined) {
            groupsByParent = new Map<string, TreeGroup<G>>();
            groupsByClassifier.set(parentId, groupsByParent);
          }

          if (groupsByParent.get(group) === undefined) {
            const newGroup = groupFactory(parentId, group);
            if (!newGroup || typeof newGroup !== "object" || typeof newGroup.nodeId !== "string") {
              continue;
            }

            groupsByParent.set(group, newGroup);
            groupsById[newGroup.nodeId] = newGroup;
          }

          const currentGroup = groupsByParent.get(group);
          if (!currentGroup || typeof currentGroup !== "object") {
            continue;
          }

          addGroup(childGroups, parentGroup, currentGroup.nodeId);
          addLeafToGroup(currentGroup, leaf);

          if (!nextParentGroupIds.has(currentGroup.nodeId)) {
            nextParentGroupIds.add(currentGroup.nodeId);
            nextParentGroups.push(currentGroup);
          }
        }
      }

      parentGroups = nextParentGroups;
    }

    parentGroups.forEach((parentGroup) => {
      addLeaf(childLeaves, parentGroup, leaf.nodeId);
    });
  }

  // TODO: iterate over groupsById to sort leaves by start here?

  return {
    root,
    groupsById,
    leavesById,
  };
};

const byLabelsWithFallback = (item: TestResult, labelNames: string[], fallbackValue: string): string[][] => {
  const labelsByName = new Map<string, string[]>();

  for (const label of item.labels) {
    const values = labelsByName.get(label.name) ?? [];

    values.push(label.value ?? fallbackValue);
    labelsByName.set(label.name, values);
  }

  return labelNames.map((labelName) => labelsByName.get(labelName) ?? []).filter((layer) => layer.length > 0);
};

export const byLabels = (item: TestResult, labelNames: string[]): string[][] =>
  byLabelsWithFallback(item, labelNames, "__unknown");

export const filterTreeLabels = (data: TestResult[], labelNames: string[]) => {
  const requested = new Set(labelNames);
  const found = new Set<string>();

  for (const item of data) {
    for (const label of item.labels) {
      if (requested.has(label.name)) {
        found.add(label.name);
      }
    }

    if (found.size === requested.size) {
      break;
    }
  }

  return labelNames.filter((labelName) => found.has(labelName));
};

export const createTreeByLabels = <T = TestResult, L = DefaultTreeLeaf, G = DefaultTreeGroup>(
  data: T[],
  labelNames: string[],
  leafFactory?: (item: T) => TreeLeaf<L>,
  groupFactory?: (parentGroup: string | undefined, groupClassifier: string) => TreeGroup<G>,
  addLeafToGroup: (group: TreeGroup<G>, leaf: TreeLeaf<L>) => void = () => {},
) => {
  const leafFactoryFn =
    leafFactory ??
    ((tr: T) => {
      const { id, name, status, duration } = tr as TestResult;

      return {
        nodeId: id,
        name,
        status,
        duration,
      } as unknown as TreeLeaf<L>;
    });
  const groupFactoryFn =
    groupFactory ??
    ((parentId, groupClassifier) =>
      ({
        nodeId: md5((parentId ? `${parentId}.` : "") + groupClassifier),
        name: groupClassifier,
        statistic: emptyStatistic(),
      }) as unknown as TreeGroup<G>);

  return createTree<T, L, G>(
    data,
    (item) => byLabels(item as TestResult, labelNames),
    leafFactoryFn,
    groupFactoryFn,
    addLeafToGroup,
  );
};

export const createTreeByCategories = <T = TestResult, L = DefaultTreeLeaf, G = DefaultTreeGroup>(
  data: T[],
  leafFactory?: (item: T) => TreeLeaf<L>,
  groupFactory?: (parentGroup: string | undefined, groupClassifier: string) => TreeGroup<G>,
  addLeafToGroup: (group: TreeGroup<G>, leaf: TreeLeaf<L>) => void = () => {},
) => {
  const leafFactoryFn =
    leafFactory ??
    ((tr: T) => {
      const { id, name, status, duration } = tr as TestResult;
      return {
        nodeId: id,
        name,
        status,
        duration,
      } as unknown as TreeLeaf<L>;
    });
  const groupFactoryFn =
    groupFactory ??
    ((parentId, groupClassifier) =>
      ({
        nodeId: md5((parentId ? `${parentId}.` : "") + groupClassifier),
        name: groupClassifier,
        statistic: emptyStatistic(),
      }) as unknown as TreeGroup<G>);

  return createTree<T, L, G>(
    data,
    (item) => byCategories(item as TestResult),
    leafFactoryFn,
    groupFactoryFn,
    addLeafToGroup,
  );
};

export const byCategories = (item: TestResult): string[][] => {
  const categories = item.categories ?? [];
  const result: string[][] = [];

  for (const category of categories) {
    result.push([category.name]);
  }

  if (item.error?.message) {
    result.push([item.error?.message]);
  }

  return result;
};

/**
 * Omits labels that don't exist in the given test results
 * If label is present at least in one test result, it will be included
 * @param labelNames
 * @param trs
 * @param labelNamesAccessor
 */
export const preciseTreeLabels = <T = TestResult>(
  labelNames: string[],
  trs: T[],
  labelNamesAccessor: (tr: T) => string[] = (tr: T) => (tr as TestResult).labels.map(({ name }) => name),
) => {
  const requested = new Set(labelNames);
  const found = new Set<string>();

  for (const tr of trs) {
    for (const labelName of labelNamesAccessor(tr)) {
      if (requested.has(labelName)) {
        found.add(labelName);
      }
    }

    if (found.size === requested.size) {
      break;
    }
  }

  const emitted = new Set<string>();

  return labelNames.filter((labelName) => {
    if (!found.has(labelName) || emitted.has(labelName)) {
      return false;
    }

    emitted.add(labelName);
    return true;
  });
};

export const processTree = <L, G>(
  tree: TreeData<L, G>,
  options: {
    filter?: (leaf: TreeLeaf<L>) => boolean;
    sort?: Comparator<TreeLeaf<L>>;
    transform?: (leaf: TreeLeaf<L>, idx: number) => TreeLeaf<L>;
  },
) => {
  const visitedGroups = new Set<string>();
  const { root, leavesById, groupsById } = tree;
  const processGroup = (group: TreeGroup<G>) => {
    if (group.groups?.length) {
      group.groups.forEach((groupId) => {
        const subGroup = groupsById[groupId];

        if (!subGroup || visitedGroups.has(groupId)) {
          return;
        }

        processGroup(subGroup);
        visitedGroups.add(groupId);
      });
    }

    if (group.leaves?.length) {
      if (options.filter) {
        group.leaves = group.leaves.filter((leaveId) => options.filter!(leavesById[leaveId]));
      }

      if (options.sort) {
        group.leaves = group.leaves.sort((a, b) => {
          const leafA = leavesById[a];
          const leafB = leavesById[b];

          return options.sort!(leafA, leafB);
        });
      }

      if (options.transform) {
        group.leaves.forEach((leafId, i) => {
          leavesById[leafId] = options.transform!(leavesById[leafId], i);
        });
      }
    }

    return group;
  };

  processGroup(root as TreeGroup<G>);

  return tree;
};

/**
 * Mutates the given tree by filtering leaves in each group.
 * Returns the link to the same tree.
 * @param tree
 * @param predicate
 */
export const filterTree = <L, G>(tree: TreeData<L, G>, predicate: (leaf: TreeLeaf<L>) => boolean) => {
  return processTree(tree, { filter: predicate });
};

/**
 * Mutates the given tree by sorting leaves in each group.
 * Returns the link to the same tree.
 * @param tree
 * @param comparator
 */
export const sortTree = <L, G>(tree: TreeData<L, G>, comparator: Comparator<TreeLeaf<L>>) => {
  return processTree(tree, { sort: comparator });
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
  return processTree(tree, { transform: transformer });
};

const DEFAULT_GROUP_PATH_SEPARATOR = " > ";

/**
 * Mutates the given tree by merging chains of groups that have no leaves of their own
 * and exactly one child group into a single group, e.g. `folder1 > folderEmpty > folder3`.
 * Mirrors how GitHub collapses directories that only contain a single subdirectory.
 * Returns the link to the same tree.
 */
export const collapseTreeGroups = <L, G extends DefaultTreeGroup>(
  tree: TreeData<L, G>,
  separator: string = DEFAULT_GROUP_PATH_SEPARATOR,
): TreeData<L, G> => {
  const { root } = tree;
  const groupsById = tree.groupsById as unknown as Record<string, TreeGroup<DefaultTreeGroup>>;
  const visited = new Set<string>();

  const collapseChildren = (node: WithChildren) => {
    node.groups?.forEach((groupId) => {
      if (visited.has(groupId)) {
        return;
      }
      visited.add(groupId);

      const group = groupsById[groupId];

      if (!group) {
        return;
      }

      while (!group.leaves?.length && group.groups?.length === 1) {
        const child = groupsById[group.groups[0] as string];

        if (!child) {
          break;
        }

        group.name = `${group.name}${separator}${child.name}`;
        group.groups = child.groups;
        group.leaves = child.leaves;
        group.statistic = child.statistic;

        delete groupsById[child.nodeId];
        visited.delete(child.nodeId);
      }

      collapseChildren(group);
    });
  };

  collapseChildren(root);

  return tree;
};

export const createTreeByTitlePath = <T = TestResult, L = DefaultTreeLeaf, G = DefaultTreeGroup>(
  data: T[],
  leafFactory?: (item: T) => TreeLeaf<L>,
  groupFactory?: (parentGroup: string | undefined, groupClassifier: string) => TreeGroup<G>,
  addLeafToGroup: (group: TreeGroup<G>, leaf: TreeLeaf<L>) => void = () => {},
) => {
  const leafFactoryFn =
    leafFactory ??
    ((tr: T) => {
      const { id, name, status, duration } = tr as TestResult;

      return {
        nodeId: id,
        name,
        status,
        duration,
      } as unknown as TreeLeaf<L>;
    });
  const groupFactoryFn =
    groupFactory ??
    ((parentId, groupClassifier) =>
      ({
        nodeId: md5((parentId ? `${parentId}.` : "") + groupClassifier),
        name: groupClassifier,
        statistic: emptyStatistic(),
      }) as unknown as TreeGroup<G>);

  return createTree(
    data,
    (item) => ((item as TestResult).titlePath ?? []).map((segment: string) => [segment]),
    leafFactoryFn,
    groupFactoryFn,
    addLeafToGroup,
  );
};

const byLabelsAndTitlePath = (item: TestResult, labelNames: string[]): string[][] => {
  const leaves = byLabelsWithFallback(item, labelNames, "");

  const titlePath = item.titlePath;
  if (Array.isArray(titlePath) && titlePath.length > 0) {
    for (const segment of titlePath) {
      leaves.push([segment]);
    }
  }

  return leaves;
};

export const createTreeByLabelsAndTitlePath = <T = TestResult, L = DefaultTreeLeaf, G = DefaultTreeGroup>(
  data: T[],
  labelNames: string[] = [],
  leafFactory?: (item: T) => TreeLeaf<L>,
  groupFactory?: (parentGroup: string | undefined, groupClassifier: string) => TreeGroup<G>,
  addLeafToGroup: (group: TreeGroup<G>, leaf: TreeLeaf<L>) => void = () => {},
) => {
  const leafFactoryFn =
    leafFactory ??
    ((tr: T) => {
      const { id, name, status, duration } = tr as TestResult;

      return {
        nodeId: id,
        name,
        status,
        duration,
      } as unknown as TreeLeaf<L>;
    });

  const groupFactoryFn =
    groupFactory ??
    ((parentId, groupClassifier) =>
      ({
        nodeId: md5((parentId ? `${parentId}.` : "") + groupClassifier),
        name: groupClassifier,
        statistic: emptyStatistic(),
      }) as unknown as TreeGroup<G>);

  return createTree<T, L, G>(
    data,
    (item) => byLabelsAndTitlePath(item as TestResult, labelNames),
    leafFactoryFn,
    groupFactoryFn,
    addLeafToGroup,
  );
};
