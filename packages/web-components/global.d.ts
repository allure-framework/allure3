import type { DefaultTreeGroup, ResolutionCategory, TestStatus, TestStatusTransition } from "@allurereport/core-api";

export type Status = TestStatus | "total";

/**
 * Tree which contains tree leaves instead of their IDs and recursive trees structure instead of groups
 */
export type RecursiveTree = DefaultTreeGroup & {
  nodeId: string;
  leaves: TreeLeaf[];
  trees: RecursiveTree[];
};

export type TreeLeaf = {
  id: string;
  nodeId: string;
  name: string;
  status?: TestStatus;
  duration?: number;
  groupOrder?: number;
  flaky?: boolean;
  retry?: boolean;
  retriesCount?: number;
  resolution?: ResolutionCategory;
  transition?: TestStatusTransition;
  transitionTooltip?: string;
  tooltips?: Record<string, string>;
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
