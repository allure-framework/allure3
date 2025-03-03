import type { BaseConfig, HistoryDataPoint, KnownTestFailure, TestLabel } from "@allurereport/core-api";
import type { Plugin, ReportFiles } from "@allurereport/plugin-api";
import type { ResultsReader } from "@allurereport/reader-api";

export interface PluginInstance {
  id: string;
  enabled: boolean;
  plugin: Plugin;
  options: Record<string, any>;
}

export type ReportVariables = Record<string, string>;

export type EnvironmentMatcherPayload = { labels: TestLabel[] };

export type EnvironmentDescriptor = {
  variables?: ReportVariables;
  matcher: (payload: EnvironmentMatcherPayload) => boolean;
};

export interface FullConfig {
  name: BaseConfig["name"];
  output: BaseConfig["output"];
  historyPath: BaseConfig["historyPath"];
  knownIssuesPath: BaseConfig["knownIssuesPath"];
  qualityGate?: BaseConfig["qualityGate"];
  defaultLabels?: BaseConfig["defaultLabels"];
  environments?: BaseConfig["environments"];
  variables?: BaseConfig["variables"];
  reportFiles: ReportFiles;
  readers?: ResultsReader[];
  plugins?: PluginInstance[];
  history: HistoryDataPoint[];
  appendHistory?: boolean;
  known?: KnownTestFailure[];
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
  realTime?: any;
}
