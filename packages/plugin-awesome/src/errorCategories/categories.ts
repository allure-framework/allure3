import type {
  CategoriesStore,
  CategoryGroupSelector,
  CategoryNode,
  CategoryNodeType,
  ErrorCategoryNorm,
  Statistic,
} from "@allurereport/core-api";
import {
  extractErrorMatchingData,
  findLastByLabelName,
  incrementStatistic,
  matchCategory,
} from "@allurereport/core-api";
import { md5 } from "@allurereport/plugin-api";
import type { AwesomeTestResult } from "@allurereport/web-awesome";
import type { AwesomeDataWriter } from "../writer.js";

const emptyStat = (): Statistic => ({
  total: 0,
});

const EMPTY_VALUE = "<Empty>";

const msgKey = (m?: string) => (m && m.trim().length ? m : EMPTY_VALUE);
const envKey = (m?: string) => (m && m.trim().length ? m : EMPTY_VALUE);

const formatEmptyValue = (key: string) => {
  if (key === "message") {
    return "No message";
  }
  if (key === "environment") {
    return "No environment";
  }
  return `No ${key}`;
};

const displayGroupValue = (key: string, value: string) => (value === EMPTY_VALUE ? formatEmptyValue(key) : value);

const formatGroupName = (key: string, value: string) => `${key}: ${displayGroupValue(key, value)}`;

type GroupLevel = {
  type: CategoryNodeType;
  key: string;
  value: string;
  name: string;
};

const extractGroupValue = (
  selector: CategoryGroupSelector,
  tr: AwesomeTestResult,
): { key: string; value: string; name: string } => {
  if (selector === "flaky") {
    const flakyValue = tr.flaky ? "true" : "false";
    return {
      key: "flaky",
      value: flakyValue,
      name: formatGroupName("flaky", flakyValue),
    };
  }
  if (selector === "transition") {
    const transitionValue = tr.transition ?? EMPTY_VALUE;
    return {
      key: "transition",
      value: transitionValue,
      name: formatGroupName("transition", transitionValue),
    };
  }
  if (selector === "owner" || selector === "severity") {
    const fallbackValue = selector === "severity" ? "normal" : EMPTY_VALUE;
    const builtInValue = findLastByLabelName(tr.labels, selector) ?? fallbackValue;
    return {
      key: selector,
      value: builtInValue,
      name: formatGroupName(selector, builtInValue),
    };
  }
  const labelName = selector.label;
  const labelValue = findLastByLabelName(tr.labels, labelName) ?? EMPTY_VALUE;
  return {
    key: labelName,
    value: labelValue,
    name: formatGroupName(labelName, labelValue),
  };
};

const buildGroupLevels = (
  category: ErrorCategoryNorm,
  tr: AwesomeTestResult,
  matchingData: ReturnType<typeof extractErrorMatchingData>,
  environmentCount: number,
  envValue: string,
): GroupLevel[] => {
  const levels: GroupLevel[] = [];
  const envGrouping = (category.groupByEnvironment ?? environmentCount > 1) && environmentCount > 1;

  for (const selector of category.groupBy) {
    const groupValue = extractGroupValue(selector, tr);
    levels.push({
      type: "group",
      key: groupValue.key,
      value: groupValue.value,
      name: groupValue.name,
    });
  }

  if (category.groupByMessage) {
    const message = msgKey(matchingData.message);
    levels.push({
      type: "message",
      key: "message",
      value: message,
      name: displayGroupValue("message", message),
    });
  }

  if (category.groupByHistoryId) {
    const historyValue = tr.historyId ?? tr.id;
    const historyName = tr.name ?? historyValue;
    levels.push({
      type: "history",
      key: "historyId",
      value: historyValue,
      name: historyName,
    });
  }

  if (envGrouping && !category.groupByHistoryId) {
    levels.push({
      type: "group",
      key: "environment",
      value: envValue,
      name: formatGroupName("environment", envValue),
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
  }: {
    tests: AwesomeTestResult[];
    categories: ErrorCategoryNorm[];
    filename?: string;
    environmentCount?: number;
  },
) => {
  const visible = tests.filter((t) => !t.hidden);

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

  const ensureCategoryNode = (category: ErrorCategoryNorm) => {
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

    const envValue = envKey(tr.environment);
    const levels = buildGroupLevels(matchedCategory, tr, matchingData, environmentCount, envValue);
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

    const leafName =
      matchedCategory.groupByHistoryId &&
      (matchedCategory.groupByEnvironment ?? environmentCount > 1) &&
      environmentCount > 1
        ? formatGroupName("environment", envValue)
        : tr.name;

    duplicateChecker({
      id: tr.id,
      type: "tr",
      name: leafName,
      status: tr.status,
      duration: tr.duration,
      flaky: tr.flaky,
      retriesCount: tr.retriesCount,
      transition: tr.transition,
      tooltips: tr.tooltips,
    });
    attachChild(parentId, tr.id);
  }

  for (const [parentId, children] of childrenMap.entries()) {
    const sorted = Array.from(children).sort((a, b) => {
      const aName = nodes[a]?.name ?? "";
      const bName = nodes[b]?.name ?? "";
      const byName = aName.localeCompare(bName);
      return byName !== 0 ? byName : a.localeCompare(b);
    });
    nodes[parentId].childrenIds = sorted;
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
