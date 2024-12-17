import type {
  DefaultTreeGroup,
  DefaultTreeLeaf,
  TestResult,
  TreeData,
  TreeGroup,
  TreeLeaf,
  WithChildren,
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

  return {
    root,
    groupsById,
    leavesById,
  };
};

const byLabels = (item: TestResult, labelNames: string[]): string[][] => {
  return labelNames.map(
    (labelName) =>
      item.labels.filter((label) => labelName === label.name).map((label) => label.value ?? "__unknown") ?? [],
  );
};

export const createTreeByLabels = (data: TestResult[], labelNames: string[]) => {
  return createTree<TestResult, DefaultTreeLeaf, DefaultTreeGroup>(
    data,
    (item) => byLabels(item, labelNames),
    ({ id, name, status, duration, flaky }) => ({
      nodeId: id,
      name,
      status,
      duration,
      flaky,
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
