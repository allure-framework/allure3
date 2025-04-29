import type {
  DefaultLabelsConfig,
  EnvironmentsConfig,
  HistoryDataPoint,
  KnownTestFailure,
  ReportVariables,
} from "@allurereport/core-api";
import type { Plugin, QualityGateConfig, ReportFiles } from "@allurereport/plugin-api";
import type { ResultsReader } from "@allurereport/reader-api";

export interface PluginInstance {
  id: string;
  enabled: boolean;
  plugin: Plugin;
  options: Record<string, any>;
}

export interface FullConfig {
  name: string;
  output: string;
  historyPath: string;
  knownIssuesPath: string;
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
  environments?: EnvironmentsConfig;
  variables?: ReportVariables;
  reportFiles: ReportFiles;
  readers?: ResultsReader[];
  plugins?: PluginInstance[];
  history: HistoryDataPoint[];
  appendHistory?: boolean;
  known?: KnownTestFailure[];
  realTime?: any;
  allureService?: {
    url?: string;
    project?: string;
    accessToken?: string;
  };
}
