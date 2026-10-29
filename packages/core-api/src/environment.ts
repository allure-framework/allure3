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

/**
 * Derives an environment from the test result labels at the moment the result arrives.
 * Returns the environment id (or an id with a display name) or `undefined` to leave the result unmatched.
 * Unlike `matcher`, it can produce environments which are not listed in the config upfront.
 * Characters not allowed in ids are replaced with `_`, the original value is kept as the name.
 */
export type DynamicEnvironmentResolver = (
  payload: EnvironmentMatcherPayload,
) => string | { id: string; name?: string } | undefined | null;

/**
 * Declarative form of the dynamic resolver: the environment is the value of the given label.
 */
export type DynamicEnvironmentLabelRule = {
  /** Name of the label whose value is used as the environment */
  label: string;
  /** Optional regular expression; the first capture group (or the whole match) becomes the environment value */
  pattern?: string | RegExp;
  /** Optional display name template, `{value}` is replaced with the environment value */
  name?: string;
};

export type DynamicEnvironmentsConfig = DynamicEnvironmentResolver | DynamicEnvironmentLabelRule;
