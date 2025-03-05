import type { EnvironmentsConfig, ReportVariables } from "./environment.js";
import type { HistoryDataPoint } from "./history.js";
import type { KnownTestFailure } from "./known.js";
import type { QualityGateConfig } from "./qualityGate.js";

export type DefaultLabelsConfig = Record<string, string | string[]>;

export interface BaseConfig {
  name: string;
  output: string;
  history: HistoryDataPoint[];
  historyPath: string;
  appendHistory?: boolean;
  knownIssuesPath: string;
  known?: KnownTestFailure[];
  qualityGate?: QualityGateConfig;
  /**
   * You can specify default labels for tests which don't have them at all
   * Could be useful if you want to highlight specific group of tests, e.g. when it's necessary to set the labels manually
   * @example
   * ```json
   * {
   *   "defaultLabels": {
   *     "severity": "unspecified severity, set it manually",
   *     "tag": ["foo", "bar"]
   *   }
   * }
   * ```
   */
  defaultLabels?: DefaultLabelsConfig;
  variables?: ReportVariables;
  environments?: EnvironmentsConfig;
}
