import type { Statistic } from "./aggregate.js";
import type { TestLabel } from "./metadata.js";
import type { TestResult, TestStatus } from "./model.js";

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
  statuses?: TestStatus[];
  labels?: Record<string, string | RegExp>;
  message?: string | RegExp;
  trace?: string | RegExp;
  flaky?: boolean;
  [k: string]: unknown;
};

export type PredicateMatcher = (d: ErrorMatchingData) => boolean;

export type Matcher = ObjectMatcher | PredicateMatcher;

export type ErrorCategoryInput = {
  name: string;
  matchers?: Matcher[];
  matcher?: Matcher;
  matchedStatuses?: TestStatus[];
  messageRegex?: string;
  traceRegex?: string;
  flaky?: boolean;
  applyTags?: string[];
  group?: string;
};

export type CategoriesStore = {
  roots: string[];
  nodes: Record<string, CategoryNode>;
};

export type ErrorCategoryNormalized = {
  name: string;
  matchers: Matcher[];
  applyTags?: string[];
  group?: string;
  index: number;
};

export type CategoryNodeProps = {
  nodeId: string;
  store: CategoriesStore;
  activeNodeId?: string;
  depth?: number;
};

export type ErrorCategoriesMode = "inclusive" | "first" | "groupExclusive";

export type ErrorCategoriesConfig = {
  mode: ErrorCategoriesMode;
  rules: ErrorCategoryInput[];
};

export type CategoryNodeType = "category" | "group" | "message" | "tr";

export type CategoryNodeItem = {
  id: string;
  type: CategoryNodeType;
  name: string;
  key?: string;
  value?: string;
  statistic?: Statistic;
  childrenIds?: string[];
  testId?: string;
};

export interface CategoryTr extends Pick<TestResult, "name" | "status" | "duration" | "id" | "flaky"> {}

export type CategoryNode = Partial<CategoryTr> & CategoryNodeItem;
