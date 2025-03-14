import type { TestLabel } from "./metadata.js";

// TODO rework
export interface EnvironmentItem {
  name: string;
  values: string[];
}

export type ReportVariables = Record<string, string>;

export type EnvironmentMatcherPayload = { labels: TestLabel[] };

export type EnvironmentDescriptor = {
  variables?: ReportVariables;
  matcher: (payload: EnvironmentMatcherPayload) => boolean;
};

export type EnvironmentsConfig = Record<string, EnvironmentDescriptor>;
