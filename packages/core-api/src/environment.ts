import type { TestLabel } from "./metadata.js";

// TODO rework
export interface EnvironmentItem {
  name: string;
  values: string[];
}

export interface EnvironmentIdentity {
  id: string;
  name: string;
  /**
   * `true` when the environment is declared in the report's `environments` config, i.e. it's an
   * environment of its own and not just the implicit fallback the report data is indexed under.
   */
  configured?: boolean;
}

export type ReportVariables = Record<string, string>;

export type EnvironmentMatcherPayload = { labels: TestLabel[] };

export type EnvironmentDescriptor = {
  name?: string;
  variables?: ReportVariables;
  matcher: (payload: EnvironmentMatcherPayload) => boolean;
};

export type EnvironmentsConfig = Record<string, EnvironmentDescriptor>;
