import type {
  CategoriesStore,
  CategoryDefinition,
  CategoryGroupSelector,
  CategoryMatchingData,
  CategoryNode,
  CategoryNodeType,
  Statistic,
} from "@allurereport/core-api";
import {
  EMPTY_VALUE,
  buildEnvironmentSortOrder,
  compareChildNodes,
  extractErrorMatchingData,
  findLastByLabelName,
  incrementStatistic,
  matchCategory,
} from "@allurereport/core-api";
import { md5 } from "@allurereport/plugin-api";
import type { AwesomeTestResult } from "@allurereport/web-awesome";
import type { AwesomeDataWriter } from "./writer.js";

type GroupLevel = {
  type: CategoryNodeType;
  key: string;
  value: string;
  name: string;
};

const emptyStat = (): Statistic => ({
  total: 0,
});
const msgKey = (m?: string) => (m && m.trim().length ? m : EMPTY_VALUE);

const envKey = (m?: string) => (m && m.trim().length ? m : EMPTY_VALUE);

const formatEmptyValue = (key: string) => {
  if (key === "message") {
    return "No message";
  }
  if (key === "transition") {
    return "No transition";
  }
  if (key === "environment") {
    return "No environment";
  }
  return `No ${key}`;
};

const hasEnvironmentSelector = (category: CategoryDefinition) =>
  category.groupBy.some((selector) => selector === "environment");

const computeGroupEnvironments = (
  category: CategoryDefinition,
  environmentCount: number,
  isSingleEnvironmentSelected: boolean,
) => {
  if (isSingleEnvironmentSelected) {
    return false;
  }

  if (category.groupEnvironments !== undefined) {
    return category.groupEnvironments;
  }

  if (environmentCount > 1 && !hasEnvironmentSelector(category)) {
    return true;
  }

  return false;
};

const displayGroupValue = (key: string, value: string) => (value === EMPTY_VALUE ? formatEmptyValue(key) : value);

const formatGroupName = (key: string, value: string) => `${key}: ${displayGroupValue(key, value)}`;

export const applyCategoriesToTestResults = (tests: AwesomeTestResult[], categories: CategoryDefinition[]) => {
  for (const tr of tests) {
    const matchingData = extractErrorMatchingData(tr);
    const matched = matchCategory(categories, matchingData);
    if (!matched) {
      tr.categories = [];
      continue;
    }

    tr.categories = [{ name: matched.name }];
  }
};

const extractGroupValue = (
  selector: CategoryGroupSelector,
  testResult: AwesomeTestResult,
): { key: string; value: string; name: string } => {
  if (selector === "flaky") {
    const flakyValue = testResult.flaky ? "true" : "false";
    return { key: "flaky", value: flakyValue, name: formatGroupName("flaky", flakyValue) };
  }

  if (selector === "transition") {
    const transitionValue = testResult.transition ?? EMPTY_VALUE;
    return { key: "transition", value: transitionValue, name: formatGroupName("transition", transitionValue) };
  }

  if (selector === "status") {
    const statusValue = testResult.status ?? "unknown";
    return { key: "status", value: statusValue, name: formatGroupName("status", statusValue) };
  }

  if (selector === "environment") {
    const environmentValue = envKey(testResult.environment);
    return { key: "environment", value: environmentValue, name: formatGroupName("environment", environmentValue) };
  }

  if (selector === "owner") {
    const ownerValue = findLastByLabelName(testResult.labels, "owner") ?? EMPTY_VALUE;
    return { key: "owner", value: ownerValue, name: formatGroupName("owner", ownerValue) };
  }

  if (selector === "severity") {
    const fallbackValue = selector === "severity" ? "normal" : EMPTY_VALUE;
    const builtInValue = findLastByLabelName(testResult.labels, selector) ?? fallbackValue;
    return {
      key: selector,
      value: builtInValue,
      name: formatGroupName(selector, builtInValue),
    };
  }

  if (selector === "layer") {
    const layerValue = findLastByLabelName(testResult.labels, "layer") ?? EMPTY_VALUE;
    return { key: "layer", value: layerValue, name: formatGroupName("layer", layerValue) };
  }

  const labelName = selector.label;
  const labelValue = findLastByLabelName(testResult.labels, labelName) ?? EMPTY_VALUE;
  return { key: labelName, value: labelValue, name: formatGroupName(labelName, labelValue) };
};

const buildGroupLevels = (
  category: CategoryDefinition,
  testResult: AwesomeTestResult,
  matchingData: CategoryMatchingData,
  environmentCount: number,
  isSingleEnvironmentSelected: boolean,
): GroupLevel[] => {
  const levels: GroupLevel[] = [];

  for (const selector of category.groupBy) {
    const groupValue = extractGroupValue(selector, testResult);
    levels.push({ type: "group", key: groupValue.key, value: groupValue.value, name: groupValue.name });
  }

  if (category.groupByMessage) {
    const messageValue = msgKey(matchingData.message);
    levels.push({
      type: "message",
      key: "message",
      value: messageValue,
      name: displayGroupValue("message", messageValue),
    });
  }

  const groupEnvironments = computeGroupEnvironments(category, environmentCount, isSingleEnvironmentSelected);

  if (groupEnvironments) {
    const testKeyValue = testResult.historyId ?? testResult.id;
    const testDisplayName = testResult.name ?? testKeyValue;
    levels.push({
      type: "history",
      key: "historyId",
      value: testKeyValue,
      name: testDisplayName,
    });
  }

  return levels;
};

export const generateCategories = async (
  writer: AwesomeDataWriter,
  {
    tests,
    categories,
    filename = "categories.json",
    environmentCount = 0,
    selectedEnvironmentCount,
    environments = [],
    defaultEnvironment = "default",
  }: {
    tests: AwesomeTestResult[];
    categories: CategoryDefinition[];
    filename?: string;
    environmentCount?: number;
    selectedEnvironmentCount?: number;
    environments?: string[];
    defaultEnvironment?: string;
  },
) => {
  const visible = tests.filter((t) => !t.hidden);
  const environmentOrderMap = buildEnvironmentSortOrder(environments, defaultEnvironment);

  const nodes: Record<string, CategoryNode> = {};
  const roots: string[] = [];

  const childrenMap = new Map<string, Set<string>>();
  const categoryOrder = categories.filter((cat) => !cat.hide).map((cat) => cat.name);
  const categoryIds = new Map<string, string>();
  const categoryTouched = new Set<string>();

  const duplicateChecker = (node: CategoryNode) => {
    nodes[node.id] ??= node;
    return nodes[node.id];
  };

  const attachChild = (parentId: string, childId: string) => {
    const set = childrenMap.get(parentId) ?? new Set<string>();
    set.add(childId);
    childrenMap.set(parentId, set);
  };

  const bumpStat = (nodeId: string, status: AwesomeTestResult["status"]) => {
    const node = nodes[nodeId];
    node.statistic ??= emptyStat();
    incrementStatistic(node.statistic, status);
  };

  const ensureCategoryNode = (category: CategoryDefinition) => {
    const catId = categoryIds.get(category.name) ?? `cat:${md5(category.name)}`;
    if (!categoryIds.has(category.name)) {
      categoryIds.set(category.name, catId);
    }
    duplicateChecker({
      id: catId,
      type: "category",
      name: category.name,
      statistic: emptyStat(),
      childrenIds: [],
      expand: category.expand,
    });
    return catId;
  };

  for (const tr of visible) {
    const matchingData = extractErrorMatchingData(tr);
    const matchedCategory = matchCategory(categories, matchingData);
    if (!matchedCategory || matchedCategory.hide) {
      continue;
    }
    const catId = ensureCategoryNode(matchedCategory);
    categoryTouched.add(matchedCategory.name);
    bumpStat(catId, tr.status);

    const environmentValue = envKey(tr.environment);

    const isSingleEnvironmentSelected = selectedEnvironmentCount === 1;

    const groupEnvironments = computeGroupEnvironments(matchedCategory, environmentCount, isSingleEnvironmentSelected);
    const levels = buildGroupLevels(matchedCategory, tr, matchingData, environmentCount, isSingleEnvironmentSelected);
    const leafName = groupEnvironments ? formatGroupName("environment", environmentValue) : tr.name;
    let parentId = catId;

    for (const level of levels) {
      const levelId = `${level.type}:${md5(`${parentId}\n${level.key}\n${level.value}`)}`;
      const historyId = level.type === "history" ? level.value : undefined;
      duplicateChecker({
        id: levelId,
        type: level.type,
        name: level.name,
        key: level.key,
        value: level.value,
        historyId,
        statistic: emptyStat(),
        childrenIds: [],
      });
      bumpStat(levelId, tr.status);
      attachChild(parentId, levelId);
      parentId = levelId;
    }

    duplicateChecker({
      id: tr.id,
      type: "tr",
      name: leafName,
      key: groupEnvironments ? "environment" : undefined,
      value: groupEnvironments ? environmentValue : undefined,
      status: tr.status,
      duration: tr.duration,
      flaky: tr.flaky,
      retriesCount: tr.retriesCount,
      transition: tr.transition,
      tooltips: tr.tooltips,
    });
    attachChild(parentId, tr.id);
  }

  for (const [parentNodeId, childNodeIds] of childrenMap.entries()) {
    const sortedChildIds = Array.from(childNodeIds).sort((leftChildId, rightChildId) =>
      compareChildNodes(leftChildId, rightChildId, nodes, environmentOrderMap),
    );

    nodes[parentNodeId].childrenIds = sortedChildIds;
  }

  for (const catName of categoryOrder) {
    if (!categoryTouched.has(catName)) {
      continue;
    }
    const id = categoryIds.get(catName);
    if (id) {
      roots.push(id);
    }
  }

  const store: CategoriesStore = { roots, nodes };
  await writer.writeWidget(filename, store);
};
