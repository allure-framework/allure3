import type { Statistic } from "./aggregate.js";
import type { TestLabel } from "./metadata.js";
import type { TestResult, TestStatus, TestStatusTransition } from "./model.js";

export type TestCategories = {
  roots: string[];
  nodes: Record<string, CategoryNode>;
};

export type ErrorMatchingData = {
  status: TestStatus;
  labels: readonly TestLabel[];
  message?: string;
  trace?: string;
  flaky: boolean;
  duration?: number;
};

export type ObjectMatcher = {
  statuses?: readonly TestStatus[];
  labels?: Record<string, string | RegExp>;
  message?: string | RegExp;
  trace?: string | RegExp;
  flaky?: boolean;
};

export type PredicateMatcher = (d: ErrorMatchingData) => boolean;

export type Matcher = ObjectMatcher | PredicateMatcher;

export type CategoryMatcher = Matcher | readonly Matcher[];

export type CategoryGroupBuiltInSelector = "flaky" | "owner" | "severity" | "transition";

export type CategoryGroupCustomSelector = {
  label: string;
};

export type CategoryGroupSelector = CategoryGroupBuiltInSelector | CategoryGroupCustomSelector;

export type ErrorCategoryRule = {
  name: string;
  matchers?: CategoryMatcher;
  groupBy?: readonly CategoryGroupSelector[];
  groupByMessage?: boolean;
  groupByEnvironment?: boolean;
  groupByHistoryId?: boolean;
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

export interface ErrorCategoryNorm
  extends Pick<ErrorCategoryRule, "name" | "groupByEnvironment" | "groupByHistoryId" | "expand" | "hide"> {
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

export type ErrorCategoriesConfig =
  | ErrorCategoryRule[]
  | {
      rules: ErrorCategoryRule[];
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

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const toRegExp = (v: string | RegExp): RegExp => (v instanceof RegExp ? v : new RegExp(v));

const isMatcherArray = (value: CategoryMatcher): value is readonly Matcher[] => Array.isArray(value);

const normalizeMatchers = (rule: ErrorCategoryRule, index: number): Matcher[] => {
  const compatKeysUsed =
    rule.matchedStatuses !== undefined ||
    rule.messageRegex !== undefined ||
    rule.traceRegex !== undefined ||
    rule.flaky !== undefined;

  if (rule.matchers !== undefined && compatKeysUsed) {
    throw new Error(`errorCategories[${index}] mixes canonical keys with compatibility keys`);
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
    if (rule.messageRegex) {
      compatMatcher.message = rule.messageRegex;
    }
    if (rule.traceRegex) {
      compatMatcher.trace = rule.traceRegex;
    }
    if (rule.flaky !== undefined) {
      compatMatcher.flaky = rule.flaky;
    }
    matchers = [compatMatcher];
  }

  if (matchers.length === 0) {
    throw new Error(`errorCategories[${index}] must define matchers or compatibility keys`);
  }

  for (let i = 0; i < matchers.length; i++) {
    const m = matchers[i];
    const ok = typeof m === "function" || isPlainObject(m);
    if (!ok) {
      throw new Error(`errorCategories[${index}].matchers[${i}] must be object|function`);
    }
  }

  return matchers;
};

export const DEFAULT_ERROR_CATEGORIES: ErrorCategoryRule[] = [
  {
    name: "Product errors",
    matchers: { statuses: ["failed"] },
  },
  {
    name: "Test errors",
    matchers: { statuses: ["broken"] },
  },
];

export const normalizeErrorCategoriesConfig = (cfg?: ErrorCategoriesConfig): ErrorCategoryNorm[] => {
  const rawRules = Array.isArray(cfg) ? cfg : (cfg?.rules ?? []);
  const rules = rawRules.length ? rawRules : [];

  const normalized: ErrorCategoryNorm[] = [];
  const seen = new Map<string, ErrorCategoryNorm>();

  const applyRule = (rule: ErrorCategoryRule, index: number) => {
    if (!isPlainObject(rule)) {
      throw new Error(`errorCategories[${index}] must be an object`);
    }
    if (typeof rule.name !== "string" || !rule.name.trim()) {
      throw new Error(`errorCategories[${index}].name must be non-empty string`);
    }

    const matchers = normalizeMatchers(rule, index);
    const existing = seen.get(rule.name);
    if (existing) {
      existing.matchers.push(...matchers);
      return;
    }

    const groupBy = Array.isArray(rule.groupBy) ? [...rule.groupBy] : [];
    for (const selector of groupBy) {
      const isBuiltIn =
        selector === "flaky" || selector === "owner" || selector === "severity" || selector === "transition";
      const isCustom = isPlainObject(selector) && typeof (selector as CategoryGroupCustomSelector).label === "string";
      if (!isBuiltIn && !isCustom) {
        throw new Error(`errorCategories[${index}].groupBy contains invalid selector`);
      }
    }

    const norm: ErrorCategoryNorm = {
      name: rule.name,
      matchers,
      groupBy,
      groupByMessage: rule.groupByMessage ?? true,
      groupByEnvironment: rule.groupByEnvironment,
      groupByHistoryId: rule.groupByHistoryId ?? false,
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

const matchObjectMatcher = (m: ObjectMatcher, d: ErrorMatchingData): boolean => {
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

  return true;
};

export const matchCategoryMatcher = (matcher: Matcher, d: ErrorMatchingData): boolean => {
  if (typeof matcher === "function") {
    return matcher(d);
  }
  if (isPlainObject(matcher)) {
    return matchObjectMatcher(matcher, d);
  }
  return false;
};

export const matchCategory = (categories: ErrorCategoryNorm[], d: ErrorMatchingData): ErrorCategoryNorm | undefined => {
  for (const c of categories) {
    if (c.matchers.some((m) => matchCategoryMatcher(m, d))) {
      return c;
    }
  }
  return undefined;
};

export const extractErrorMatchingData = (
  tr: Pick<TestResult, "status" | "labels" | "error" | "flaky" | "duration">,
): ErrorMatchingData => {
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
  };
};
