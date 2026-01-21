import type { TestStatus } from "@allurereport/core-api";

export type SortByField = "order" | "duration" | "status" | "name";
export type Direction = "asc" | "desc";
export type SortBy = `${SortByField},${Direction}`;
export type Transition = "new" | "fixed" | "regressed" | "malfunctioned";

export type Filters = {
  query?: string;
  status?: TestStatus;
  flaky?: boolean;
  retry?: boolean;
  transition?: Transition[];
  tags?: string[];
  sortBy?: SortBy;
};
