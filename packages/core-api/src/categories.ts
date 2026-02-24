import type { Statistic } from "./aggregate.js";
import type { TestLabel } from "./metadata.js";
import type { TestResult, TestStatus, TestStatusTransition } from "./model.js";

export const EMPTY_VALUE = "<Empty>";
export const STATUS_ORDER: Record<string, number> = {
  failed: 0,
  broken: 1,
  passed: 2,
  skipped: 3,
  unknown: 4,
};

export const SEVERITY_ORDER: Record<string, number> = {
  blocker: 0,
  critical: 1,
  normal: 2,
  minor: 3,
  trivial: 4,
};

export const TRANSITION_ORDER: Record<string, number> = {
  regressed: 0,
  malfunctioned: 1,
  new: 2,
  fixed: 3,
};

export const DEFAULT_ERROR_CATEGORIES: CategoryRule[] = [
  {
    name: "Product errors",
    matchers: { statuses: ["failed"] },
  },
  {
    name: "Test errors",
    matchers: { statuses: ["broken"] },
  },
];

export type TestCategories = {
  roots: string[];
  nodes: Record<string, CategoryNode>;
};

export type CategoryMatchingData = {
  status: TestStatus;
  labels: readonly TestLabel[];
  message?: string;
  trace?: string;
  flaky: boolean;
  duration?: number;
  transition?: TestStatusTransition;
  environment?: string;
};

export type ObjectMatcher = {
  statuses?: readonly TestStatus[];
  labels?: Record<string, string | RegExp>;
  message?: string | RegExp;
  trace?: string | RegExp;
  flaky?: boolean;
  transitions?: readonly TestStatusTransition[];
  environments?: readonly string[];
};

export type PredicateMatcher = (d: CategoryMatchingData) => boolean;

export type Matcher = ObjectMatcher | PredicateMatcher;

export type CategoryMatcher = Matcher | readonly Matcher[];

export type CategoryGroupBuiltInSelector =
  | "flaky"
  | "owner"
  | "severity"
  | "transition"
  | "status"
  | "environment"
  | "layer";

export type CategoryGroupCustomSelector = {
  label: string;
};

export type CategoryGroupSelector = CategoryGroupBuiltInSelector | CategoryGroupCustomSelector;

export type CategoryRule = {
  name: string;
  matchers?: CategoryMatcher;
  groupBy?: readonly CategoryGroupSelector[];
  groupByMessage?: boolean;
  groupEnvironments?: boolean;
  expand?: boolean;
  hide?: boolean;
  matchedStatuses?: readonly TestStatus[];
  messageRegex?: string;
  traceRegex?: string;
  flaky?: boolean;
};

export type CategoriesStore = {
  roots: string[];
  nodes: Record<string, CategoryNode>;
};

export interface CategoryDefinition extends Pick<CategoryRule, "name" | "expand" | "hide" | "groupEnvironments"> {
  matchers: Matcher[];
  groupBy: CategoryGroupSelector[];
  groupByMessage: boolean;
  index: number;
}

export type CategoryNodeProps = {
  nodeId: string;
  store: CategoriesStore;
  activeNodeId?: string;
  depth?: number;
};

export type CategoriesConfig =
  | false
  | CategoryRule[]
  | {
      rules: CategoryRule[];
    };

export type CategoryNodeType = "category" | "group" | "history" | "message" | "tr";

export type CategoryNodeItem = {
  id: string;
  type: CategoryNodeType;
  name: string;
  key?: string;
  value?: string;
  historyId?: string;
  retriesCount?: number;
  transition?: TestStatusTransition;
  tooltips?: Record<string, string>;
  statistic?: Statistic;
  childrenIds?: string[];
  testId?: string;
  expand?: boolean;
};

export interface CategoryTr extends Pick<TestResult, "name" | "status" | "duration" | "id" | "flaky" | "transition"> {}

export type CategoryNode = Partial<CategoryTr> & CategoryNodeItem;

type GroupSortKey = {
  missingRank: number;
  primaryRank: number;
  alphaKey: string;
};
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const toRegExp = (v: string | RegExp): RegExp => (v instanceof RegExp ? v : new RegExp(v));

const isMatcherArray = (value: CategoryMatcher): value is readonly Matcher[] => Array.isArray(value);
const normalizeMatchers = (rule: CategoryRule, index: number): Matcher[] => {
  const compatKeysUsed =
    rule.matchedStatuses !== undefined ||
    rule.messageRegex !== undefined ||
    rule.traceRegex !== undefined ||
    rule.flaky !== undefined;
  if (rule.matchers !== undefined && compatKeysUsed) {
    throw new Error(`categories[${index}] mixes canonical keys with compatibility keys`);
  }

  let matchers: Matcher[] = [];
  if (rule.matchers !== undefined) {
    if (isMatcherArray(rule.matchers)) {
      matchers = [...rule.matchers];
    } else {
      matchers = [rule.matchers];
    }
  } else if (compatKeysUsed) {
    const compatMatcher: ObjectMatcher = {};
    if (rule.matchedStatuses) {
      compatMatcher.statuses = rule.matchedStatuses;
    }
    if (rule.messageRegex !== undefined) {
      compatMatcher.message = rule.messageRegex;
    }
    if (rule.traceRegex !== undefined) {
      compatMatcher.trace = rule.traceRegex;
    }
    if (rule.flaky !== undefined) {
      compatMatcher.flaky = rule.flaky;
    }
    matchers = [compatMatcher];
  }
  if (matchers.length === 0) {
    throw new Error(`categories[${index}] must define matchers`);
  }
  for (let i = 0; i < matchers.length; i++) {
    const m = matchers[i];
    const ok = typeof m === "function" || isPlainObject(m);
    if (!ok) {
      throw new Error(`categories[${index}].matchers[${i}] must be object|function`);
    }
  }
  return matchers;
};

export const normalizeCategoriesConfig = (cfg?: CategoriesConfig): CategoryDefinition[] => {
  if (cfg === false) {
    return [];
  }
  const rawRules = Array.isArray(cfg) ? cfg : (cfg?.rules ?? []);
  const rules = rawRules.length ? rawRules : [];

  const normalized: CategoryDefinition[] = [];
  const seen = new Map<string, CategoryDefinition>();

  const applyRule = (rule: CategoryRule, index: number) => {
    if (!isPlainObject(rule)) {
      throw new Error(`categories[${index}] must be an object`);
    }
    if (typeof rule.name !== "string" || !rule.name.trim()) {
      throw new Error(`categories[${index}].name must be non-empty string`);
    }

    const matchers = normalizeMatchers(rule, index);
    const existing = seen.get(rule.name);
    if (existing) {
      existing.matchers.push(...matchers);
      return;
    }
    const BUILT_IN_GROUP_SELECTORS = new Set<CategoryGroupBuiltInSelector>([
      "flaky",
      "owner",
      "severity",
      "transition",
      "status",
      "environment",
      "layer",
    ]);

    const groupBy = Array.isArray(rule.groupBy) ? [...rule.groupBy] : [];
    for (const selector of groupBy) {
      const isBuiltIn =
        typeof selector === "string" && BUILT_IN_GROUP_SELECTORS.has(selector as CategoryGroupBuiltInSelector);
      const isCustom =
        isPlainObject(selector) &&
        typeof (selector as CategoryGroupCustomSelector).label === "string" &&
        (selector as CategoryGroupCustomSelector).label.trim().length > 0;

      if (!isBuiltIn && !isCustom) {
        throw new Error(`categories[${index}].groupBy contains invalid selector`);
      }
    }

    const norm: CategoryDefinition = {
      name: rule.name,
      matchers,
      groupBy,
      groupByMessage: rule.groupByMessage ?? true,
      groupEnvironments: rule.groupEnvironments,
      expand: rule.expand ?? false,
      hide: rule.hide ?? false,
      index,
    };
    seen.set(rule.name, norm);
    normalized.push(norm);
  };

  rules.forEach(applyRule);
  DEFAULT_ERROR_CATEGORIES.forEach((rule, index) => applyRule(rule, rules.length + index));

  return normalized;
};

const matchObjectMatcher = (m: ObjectMatcher, d: CategoryMatchingData): boolean => {
  if (m.statuses && !m.statuses.includes(d.status)) {
    return false;
  }
  if (m.flaky !== undefined && m.flaky !== d.flaky) {
    return false;
  }

  if (m.labels) {
    for (const [labelName, expected] of Object.entries(m.labels)) {
      const re = toRegExp(expected as any);
      const values = d.labels.filter((l) => l.name === labelName).map((l) => l.value ?? "");
      if (!values.some((v) => re.test(v))) {
        return false;
      }
    }
  }

  if (m.message !== undefined) {
    const re = toRegExp(m.message);
    if (!re.test(d.message ?? "")) {
      return false;
    }
  }

  if (m.trace !== undefined) {
    const re = toRegExp(m.trace);
    if (!re.test(d.trace ?? "")) {
      return false;
    }
  }

  if (m.transitions && !m.transitions.includes(d.transition as TestStatusTransition)) {
    return false;
  }

  if (m.environments && !m.environments.includes(d.environment ?? EMPTY_VALUE)) {
    return false;
  }

  return true;
};

export const matchCategoryMatcher = (matcher: Matcher, d: CategoryMatchingData): boolean => {
  if (typeof matcher === "function") {
    return matcher(d);
  }
  if (isPlainObject(matcher)) {
    return matchObjectMatcher(matcher, d);
  }
  return false;
};

export const matchCategory = (
  categories: CategoryDefinition[],
  d: CategoryMatchingData,
): CategoryDefinition | undefined => {
  for (const c of categories) {
    if (c.matchers.some((m) => matchCategoryMatcher(m, d))) {
      return c;
    }
  }
  return undefined;
};

export const extractErrorMatchingData = (
  tr: Pick<TestResult, "status" | "labels" | "error" | "flaky" | "duration" | "transition" | "environment">,
): CategoryMatchingData => {
  const { message, trace } = tr.error ?? {};
  const labels: TestLabel[] = Array.isArray(tr.labels)
    ? tr.labels.map((l) => ({ name: l.name, value: l.value ?? "" }))
    : [];

  return {
    status: tr.status,
    labels,
    message,
    trace,
    flaky: tr.flaky,
    duration: tr.duration,
    transition: tr.transition,
    environment: tr.environment,
  };
};

export const buildEnvironmentSortOrder = (environmentNames: string[], defaultEnvironmentName: string) => {
  const orderMap = new Map<string, number>();

  for (let index = 0; index < environmentNames.length; index++) {
    orderMap.set(environmentNames[index], index);
  }

  const missingEnvironmentRank = environmentNames.length;

  const defaultEnvironmentRank = environmentNames.length + 1;

  orderMap.set(EMPTY_VALUE, missingEnvironmentRank);
  orderMap.set(defaultEnvironmentName, defaultEnvironmentRank);

  return orderMap;
};

export const compareNumbers = (left: number, right: number) => (left < right ? -1 : left > right ? 1 : 0);

export const compareStrings = (left: string, right: string) => left.localeCompare(right);

export const isMissingValue = (value: string | undefined) => (value ?? EMPTY_VALUE) === EMPTY_VALUE;

export const getGroupSortKey = (
  groupKey: string | undefined,
  groupValue: string | undefined,
  environmentOrderMap?: Map<string, number>,
): GroupSortKey => {
  const normalizedValue = groupValue ?? EMPTY_VALUE;
  const missingRank = normalizedValue === EMPTY_VALUE ? 1 : 0;

  if (groupKey === "status") {
    const primaryRank = STATUS_ORDER[normalizedValue] ?? 999;
    return { primaryRank, missingRank, alphaKey: normalizedValue };
  }

  if (groupKey === "severity") {
    const primaryRank = SEVERITY_ORDER[normalizedValue] ?? 999;
    return { primaryRank, missingRank, alphaKey: normalizedValue };
  }

  if (groupKey === "transition") {
    const primaryRank = TRANSITION_ORDER[normalizedValue] ?? 999;
    return { primaryRank, missingRank, alphaKey: normalizedValue };
  }

  if (groupKey === "flaky") {
    const primaryRank = normalizedValue === "true" ? 0 : 1;
    return { primaryRank, missingRank, alphaKey: normalizedValue };
  }

  if (groupKey === "environment") {
    if (environmentOrderMap) {
      const primaryRank = environmentOrderMap.get(normalizedValue) ?? 1000;
      // default env last is handled by map
      return { primaryRank, missingRank: 0, alphaKey: normalizedValue };
    }
    return { primaryRank: 0, missingRank, alphaKey: normalizedValue };
  }

  return { primaryRank: 0, missingRank, alphaKey: normalizedValue };
};

export const compareChildNodes = (
  leftNodeId: string,
  rightNodeId: string,
  nodesById: Record<string, CategoryNode>,
  environmentOrderMap?: Map<string, number>,
): number => {
  const leftNode = nodesById[leftNodeId];
  const rightNode = nodesById[rightNodeId];

  const leftType = leftNode?.type ?? "";
  const rightType = rightNode?.type ?? "";

  if (leftType === "message" && rightType === "message") {
    const leftTotal = leftNode.statistic?.total ?? 0;
    const rightTotal = rightNode.statistic?.total ?? 0;

    const byCountDescending = compareNumbers(rightTotal, leftTotal);
    if (byCountDescending !== 0) {
      return byCountDescending;
    }

    const byNameMessage = compareStrings(leftNode.name ?? "", rightNode.name ?? "");
    if (byNameMessage !== 0) {
      return byNameMessage;
    }

    return compareStrings(leftNodeId, rightNodeId);
  }

  if (leftType === "tr" && rightType === "tr") {
    const leftKey = leftNode.key;
    const rightKey = rightNode.key;
    if (leftKey === "environment" && rightKey === "environment") {
      const leftSortKey = getGroupSortKey("environment", leftNode.value, environmentOrderMap);
      const rightSortKey = getGroupSortKey("environment", rightNode.value, environmentOrderMap);

      const byPrimaryRank = compareNumbers(leftSortKey.primaryRank, rightSortKey.primaryRank);
      if (byPrimaryRank !== 0) {
        return byPrimaryRank;
      }

      const byMissingLast = compareNumbers(leftSortKey.missingRank, rightSortKey.missingRank);
      if (byMissingLast !== 0) {
        return byMissingLast;
      }

      const byAlpha = compareStrings(leftSortKey.alphaKey, rightSortKey.alphaKey);
      if (byAlpha !== 0) {
        return byAlpha;
      }

      return compareStrings(leftNodeId, rightNodeId);
    }
  }

  if (leftType === "group" && rightType === "group") {
    const leftGroupKey = leftNode.key ?? "";
    const rightGroupKey = rightNode.key ?? "";

    const byGroupKey = compareStrings(leftGroupKey, rightGroupKey);
    if (byGroupKey !== 0) {
      return byGroupKey;
    }

    const leftSortKey = getGroupSortKey(leftGroupKey, leftNode.value, environmentOrderMap);
    const rightSortKey = getGroupSortKey(rightGroupKey, rightNode.value, environmentOrderMap);

    const byPrimaryRank = compareNumbers(leftSortKey.primaryRank, rightSortKey.primaryRank);
    if (byPrimaryRank !== 0) {
      return byPrimaryRank;
    }

    const byMissingLast = compareNumbers(leftSortKey.missingRank, rightSortKey.missingRank);
    if (byMissingLast !== 0) {
      return byMissingLast;
    }

    const byAlpha = compareStrings(leftSortKey.alphaKey, rightSortKey.alphaKey);
    if (byAlpha !== 0) {
      return byAlpha;
    }

    return compareStrings(leftNodeId, rightNodeId);
  }

  const byType = compareStrings(leftType, rightType);
  if (byType !== 0) {
    return byType;
  }

  const byName = compareStrings(leftNode?.name ?? "", rightNode?.name ?? "");
  if (byName !== 0) {
    return byName;
  }

  return compareStrings(leftNodeId, rightNodeId);
};
