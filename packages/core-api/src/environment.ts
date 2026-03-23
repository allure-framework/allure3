import type { TestLabel } from "./metadata.js";

// TODO rework
export interface EnvironmentItem {
  name: string;
  values: string[];
}

export interface EnvironmentIdentity {
  id: string;
  name: string;
}

export type ReportVariables = Record<string, string>;

export type EnvironmentMatcherPayload = { labels: TestLabel[] };

export type EnvironmentDescriptor = {
  name?: string;
  variables?: ReportVariables;
  matcher: (payload: EnvironmentMatcherPayload) => boolean;
};

export type EnvironmentsConfig = Record<string, EnvironmentDescriptor>;
