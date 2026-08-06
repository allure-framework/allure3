import type { DefaultTreeGroup, DefaultTreeLeaf, TestStatus, TestStatusTransition } from "@allurereport/core-api";

export type Status = TestStatus | "total";

export type TreeLeaf = DefaultTreeLeaf & {
  nodeId: string;
  groupOrder?: number;
  retriesCount?: number;
  flaky?: boolean;
  known?: boolean;
  transition?: TestStatusTransition;
  transitionTooltip?: string;
  tooltips?: Record<string, string>;
};

/**
 * Tree which contains tree leaves instead of their IDs and recursive trees structure instead of groups
 */
export type RecursiveTree = DefaultTreeGroup & {
  nodeId: string;
  leaves: TreeLeaf[];
  trees: RecursiveTree[];
};

export type TreeSortBy = "order" | "duration" | "status" | "alphabet";
export type TreeDirection = "asc" | "desc";
export type TreeFilters = "flaky" | "retry" | "new";
export type TreeFiltersState = {
  query: string;
  status: Status;
  filter: Record<TreeFilters, boolean>;
  sortBy: TreeSortBy;
  direction: TreeDirection;
};
