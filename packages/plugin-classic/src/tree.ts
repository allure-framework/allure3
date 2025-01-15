import type { Statistic } from "@allurereport/core-api";
import { byStatistic, compareBy } from "@allurereport/core-api";
import { createHash } from "node:crypto";
import type { Allure2Status, Allure2TestResult, Allure2Time } from "./model.js";
import { calculateStatisticByLeafs } from "./utils.js";

export interface TreeNode {
  name: string;
}

export interface TreeGroup extends TreeNode {
  uid: string;
  name: string;
  children: TreeNode[];
}

export interface TreeLeaf extends TreeNode {
  uid: string;
  parentUid: string;
  status: Allure2Status;
  time: Allure2Time;
  flaky: boolean;
  newFailed: boolean;
  newBroken: boolean;
  newPassed: boolean;
  retriesCount: number;
  retriesStatusChange: boolean;
  tags: string[];
  parameters: string[];
}

export interface TreeLayer {
  groups: string[];
}

export interface WidgetItem {
  uid: string;
  name: string;
  statistic: Statistic;
}

export interface WidgetData {
  items: WidgetItem[];
  total: number;
}

const rootNodeUid = "__ROOT__";

const createLeaf = (endNode: TreeGroup, test: Allure2TestResult) => {
  const leaf: TreeLeaf = {
    parentUid: endNode.uid,
    uid: test.uid,
    name: test.name,
    status: test.status,
    time: { ...test.time },
    flaky: test.flaky,
    newFailed: test.newFailed,
    newBroken: test.newBroken,
    newPassed: test.newPassed,
    retriesCount: test.retriesCount,
    retriesStatusChange: test.retriesStatusChange,
    parameters: test.parameters.filter((p) => p.value).map((p) => p.value!),
    tags: test.extra.tags ?? [],
  };
  return leaf;
};

export type LeafFactory = typeof createLeaf;

export type Classifier = (test: Allure2TestResult) => TreeLayer[] | undefined;

export const byLabels = (labelNames: string[]): Classifier => {
  return (test) => groupByLabels(test, labelNames);
};

export const createTree = (
  tests: Allure2TestResult[],
  classifier: Classifier,
  leafFactory: LeafFactory = createLeaf,
) => {
  const groups: Map<string, TreeGroup> = new Map();

  const root: TreeGroup = { uid: rootNodeUid, name: rootNodeUid, children: [] };
  groups.set(root.uid, root);

  for (const test of tests) {
    const treeLayers = classifier(test);
    if (!treeLayers) {
      continue;
    }
    getEndNodes(test, root, treeLayers, 0, groups).forEach((endNode) => {
      const leaf = leafFactory(endNode, test);
      endNode.children.push(leaf);
    });
  }

  return root;
};

const getEndNodes = (
  item: Allure2TestResult,
  node: TreeGroup,
  classifiers: TreeLayer[],
  index: number,
  groups: Map<string, TreeGroup>,
): TreeGroup[] => {
  if (index >= classifiers.length) {
    return [node];
  }
  const layer = classifiers[index];
  return layer.groups.flatMap((name) => {
    const uid = groupUid(node.uid, name);
    if (!groups.has(uid)) {
      const value = { uid, name, children: [] };
      groups.set(uid, value);
      node.children.push(value);
    }
    const treeGroup = groups.get(uid)!;
    return getEndNodes(item, treeGroup, classifiers, index + 1, groups);
  });
};

const groupByLabels = (test: Allure2TestResult, labelNames: string[]): TreeLayer[] => {
  const result: TreeLayer[] = [];
  for (const name of labelNames) {
    const groups = test.labels
      .filter((label) => label.name === name)
      .filter((label) => !!label.value)
      .map((label) => label.value!);

    if (groups.length !== 0) {
      result.push({ groups: Array.from(new Set<string>(groups)) });
    }
  }

  return result;
};

const groupUid = (parentUid: string | undefined, groupName: string) => {
  return md5(parentUid ? `${parentUid}.${groupName}` : groupName);
};

const md5 = (data: string) => createHash("md5").update(data).digest("hex");

export const collapseTree = (treeGroup: TreeGroup, separator: string = "."): TreeGroup => {
  const newChildren = treeGroup.children.map((c) => {
    if (!("children" in c)) {
      return c;
    }

    let res = c as TreeGroup;
    while (res.children.length === 1 && "children" in res.children[0]) {
      const child = res.children[0] as TreeGroup;
      res = {
        uid: groupUid(res.uid, child.uid),
        name: res.name + separator + child.name,
        children: child.children,
      };
    }
    return res;
  });
  treeGroup.children = newChildren;
  return treeGroup;
};

export const createWidget = (root: TreeGroup): WidgetData => {
  const items = root.children
    .map((c): WidgetItem | undefined => {
      if (!("children" in c)) {
        return undefined;
      }

      const res = c as TreeGroup;
      const statistic = calculateStatisticByLeafs(res);
      return { uid: res.uid, name: res.name, statistic };
    })
    .filter((value) => value)
    .map((value) => value!)
    .sort(compareBy("statistic", byStatistic()))
    .slice(0, 10);

  return {
    items,
    total: root.children.length,
  };
};
